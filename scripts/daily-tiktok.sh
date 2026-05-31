#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . ".env.local"
  set +a
fi

POSTIZ_BASE_URL="${POSTIZ_BASE_URL:-http://127.0.0.1:4007/api/public/v1}"
POSTIZ_BASE_URL="${POSTIZ_BASE_URL/localhost/127.0.0.1}"
POSTIZ_POST_TYPE="${POSTIZ_POST_TYPE:-draft}"
POSTIZ_TIKTOK_PROFILE="${POSTIZ_TIKTOK_PROFILE:-downloadbare}"

if [ -z "${POSTIZ_API_KEY:-}" ]; then
  echo "POSTIZ_API_KEY is missing from .env.local." >&2
  exit 1
fi

dry_run_json="$(node --import tsx scripts/daily-tiktok.ts --dry-run "$@")"
profile="$(printf '%s' "$dry_run_json" | jq -r '.profile')"
post_type="$(printf '%s' "$dry_run_json" | jq -r '.postType')"

integrations_json="$(curl -fsSL -H "Authorization: $POSTIZ_API_KEY" "$POSTIZ_BASE_URL/integrations")"
integration_id="$(
  printf '%s' "$integrations_json" | jq -r --arg profile "$profile" '
    [
      .[]
      | select(.identifier == "tiktok")
      | select(
          ((.profile // "") | ascii_downcase) == ($profile | ascii_downcase)
          or ((.name // "") | ascii_downcase) == ($profile | ascii_downcase)
        )
    ][0].id // empty
  '
)"

if [ -z "$integration_id" ]; then
  echo "TikTok integration \"$profile\" was not found in Postiz." >&2
  exit 1
fi

results='[]'

while IFS= read -r item; do
  [ -n "$item" ] || continue
  job_dir="$(printf '%s' "$item" | jq -r '.jobDir')"
  package_path="$job_dir/package.json"
  captions_path="$job_dir/captions.txt"

  uploads='[]'
  while IFS= read -r relative_image; do
    [ -n "$relative_image" ] || continue
    upload_json="$(
      curl -fsSL \
        -H "Authorization: $POSTIZ_API_KEY" \
        -F "file=@$job_dir/$relative_image" \
        "$POSTIZ_BASE_URL/upload"
    )"
    uploads="$(jq -cn --argjson arr "$uploads" --argjson item "$upload_json" '$arr + [$item]')"
  done < <(jq -r '.generatedImages[]' "$package_path")

  caption="$(
    jq -r '
      (
        [
          .mainCaption,
          ((.hashtags // []) | join(" "))
        ]
        | map(select(length > 0))
        | join("\n\n")
      ) as $caption
      | if ($caption | length) > 2150 then ($caption[0:2147] + "...") else $caption end
    ' "$package_path"
  )"

  post_body="$(
    jq -cn \
      --arg type "$post_type" \
      --arg date "$(printf '%s' "$item" | jq -r '.date')" \
      --arg integrationId "$integration_id" \
      --arg caption "$caption" \
      --argjson uploads "$uploads" \
      '{
        type: $type,
        creationMethod: "carousel-cloner",
        date: $date,
        shortLink: true,
        tags: [],
        posts: [
          {
            integration: {
              id: $integrationId
            },
            value: [
              {
                content: $caption,
                image: ($uploads | map({ id: .id, path: .path })),
                delay: 0
              }
            ],
            settings: {
              privacy_level: "PUBLIC_TO_EVERYONE",
              duet: false,
              stitch: false,
              comment: true,
              autoAddMusic: "yes",
              brand_content_toggle: false,
              brand_organic_toggle: false,
              content_posting_method: "UPLOAD"
            }
          }
        ]
      }'
  )"

  postiz_response="$(
    curl -fsSL \
      -H "Authorization: $POSTIZ_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary "$post_body" \
      "$POSTIZ_BASE_URL/posts"
  )"

  result_json="$(
    printf '%s' "$item" | jq \
      --arg integrationId "$integration_id" \
      --arg captionsPath "$captions_path" \
      --argjson postizResponse "$postiz_response" \
      '.integrationId = $integrationId | .captionsPath = $captionsPath | .postizResponse = $postizResponse'
  )"
  results="$(jq -cn --argjson arr "$results" --argjson item "$result_json" '$arr + [$item]')"
done < <(printf '%s' "$dry_run_json" | jq -c '.results[]')

jq -cn \
  --arg profile "$profile" \
  --arg postType "$post_type" \
  --argjson results "$results" \
  '{ dryRun: false, postType: $postType, profile: $profile, results: $results }'
