#!/bin/bash
set -euo pipefail

# Narration script aligned to scene-timestamps.json
# Voice: Samantha (natural en_US)

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

STAMPS="$DIR/scene-timestamps.json"
if [[ ! -f "$STAMPS" ]]; then
  echo "Missing scene-timestamps.json — run record.js first" >&2
  exit 1
fi

VOICE="Samantha"
RATE=190

# Parse scene times with node
eval "$(node -e '
const j=require("./scene-timestamps.json");
const m=Object.fromEntries(j.scenes.map(s=>[s.name,s.at]));
const g=(k)=>m[k]||0;
// Prefer real scene marks; fall back proportionally
console.log(`T_LANDING=${g("s1_landing")}`);
console.log(`T_DASH=${g("s1_dashboard")}`);
console.log(`T_FORM=${g("s2_new_kit_form")}`);
console.log(`T_FILLED=${g("s2_form_filled")}`);
console.log(`T_GEN=${g("s2_generating_dashboard")}`);
console.log(`T_CHECK=${g("s2_checklist")}`);
console.log(`T_READY=${g("s3_kit_ready")}`);
console.log(`T_COV=${g("s3_coverage")}`);
console.log(`T_BRIEF=${g("s3_brief")}`);
console.log(`T_RES=${g("s3_research")}`);
console.log(`T_Q=${g("s4_questions")}`);
console.log(`T_ED=${g("s4_edited")}`);
console.log(`T_PIN=${g("s4_pinned")}`);
console.log(`T_ORD=${g("s4_reordered")}`);
console.log(`T_SAV=${g("s4_saved")}`);
console.log(`T_REG=${g("s4_regenerated")}`);
console.log(`T_KEEP=${g("s4_pin_survived")}`);
console.log(`T_PR=${g("s5_practice")}`);
console.log(`T_REV=${g("s5_revealed")}`);
console.log(`T_RATE=${g("s5_rated")}`);
console.log(`T_SCH=${g("s6_schedule")}`);
console.log(`T_WS=${g("s7_weak_spots")}`);
console.log(`T_OUT=${g("outro")}`);
console.log(`T_TOTAL=${j.total}`);
')"

mkdir -p "$DIR/vo"

# Write narration lines (concise, matches shot list)
cat > "$DIR/vo/n01.txt" <<'EOF'
Here's Prep Kit end to end. We start on the landing page, log in, and land on the dashboard where every kit lives.
EOF

cat > "$DIR/vo/n02.txt" <<'EOF'
Create a kit: paste the job description, the company URL, and how many days you have. The pipeline extracts requirements, researches the company, builds questions, checks coverage, and allocates the schedule.
EOF

cat > "$DIR/vo/n03.txt" <<'EOF'
Each step is saved as it finishes, so you can leave and come back. Generation continues in the background.
EOF

cat > "$DIR/vo/n04.txt" <<'EOF'
On the kit, coverage is checked deterministically, not by the model. Check passes shows how many sweeps were needed to close must-have gaps. Company brief and research notes come from crawling, with any failures reported honestly.
EOF

cat > "$DIR/vo/n05.txt" <<'EOF'
Questions are editable. Change a prompt, pin it so regeneration keeps it, reorder within a category, then regenerate. Edited and pinned items survive.
EOF

cat > "$DIR/vo/n06.txt" <<'EOF'
Practice is least confident first. Reveal the answer, rate yourself one to five, and lower scores float to the top of the next session.
EOF

cat > "$DIR/vo/n07.txt" <<'EOF'
The schedule is allocated in code: harder and must-have questions land earlier, durations are integer minutes. Weak spots merges open coverage with low practice scores into one prioritised list. The model never allocates your schedule or decides final coverage, deterministic code does.
EOF

cat > "$DIR/vo/n08.txt" <<'EOF'
Turn a posting into a defensible prep plan. Prep Kit, free to run locally with Ollama, no API key required.
EOF

# Generate WAV for each line
gen() {
  local id="$1" text="$2"
  say -v "$VOICE" -r "$RATE" -o "$DIR/vo/$id.aiff" "$text"
  ffmpeg -y -hide_banner -loglevel error -i "$DIR/vo/$id.aiff" -ar 48000 -ac 2 "$DIR/vo/$id.wav"
  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DIR/vo/$id.wav")
  echo "$id ${dur}s"
}

echo "Generating narration..."
gen n01 "$(cat "$DIR/vo/n01.txt")"
gen n02 "$(cat "$DIR/vo/n02.txt")"
gen n03 "$(cat "$DIR/vo/n03.txt")"
gen n04 "$(cat "$DIR/vo/n04.txt")"
gen n05 "$(cat "$DIR/vo/n05.txt")"
gen n06 "$(cat "$DIR/vo/n06.txt")"
gen n07 "$(cat "$DIR/vo/n07.txt")"
gen n08 "$(cat "$DIR/vo/n08.txt")"

# Build delay map: place VO near scene starts (with small lead-in)
# n01 -> landing, n02 -> form filled, n03 -> checklist, n04 -> coverage
# n05 -> questions, n06 -> practice, n07 -> weak spots, n08 -> outro
node > "$DIR/vo/delays.txt" <<'EOF'
const j = require("./scene-timestamps.json");
const m = Object.fromEntries(j.scenes.map(s => [s.name, s.at]));
const pairs = [
  ["n01", m.s1_landing ?? 0],
  ["n02", m.s2_form_filled ?? m.s2_new_kit_form ?? 15],
  ["n03", m.s2_checklist ?? m.s2_generating_dashboard ?? 30],
  ["n04", m.s3_coverage ?? m.s3_kit_ready ?? 50],
  ["n05", m.s4_questions ?? 70],
  ["n06", m.s5_practice ?? 100],
  ["n07", m.s7_weak_spots ?? m.s6_schedule ?? 130],
  ["n08", m.outro ?? (j.total - 8)],
];
for (const [id, t] of pairs) {
  const delay = Math.max(0, Math.round(t * 1000));
  console.log(`${id} ${delay}`);
}
EOF

# Build silence base track of video length, then overlay VO at delays
# First get video duration
VID="${1:-$DIR/walkthrough.mp4}"
if [[ ! -f "$VID" ]]; then
  VID="$DIR/walkthrough-silent.mp4"
fi
VDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VID")
echo "Video duration: ${VDUR}s"

# Create filter_complex to delay each VO and amix onto silent track
# Start from video's audio or generate silence
INPUTS=(-i "$VID")
FILTER=""
MIX=""
idx=0
while read -r id delay; do
  INPUTS+=(-i "$DIR/vo/$id.wav")
  # delay in ms
  FILTER+="[${idx + 1}:a]adelay=${delay}|${delay}[d${idx}];"
  MIX+="[d${idx}]"
  idx=$((idx + 1))
done < "$DIR/vo/delays.txt"

# silence base as first mix input — use anullsrc
# Actually first input is video which may have no audio; add silent audio
# Simpler: use video as input 0, if it has audio keep it low or mute
FILTER+="[0:a]volume=0[sil];"
MIX="[sil]${MIX}"
FILTER+="${MIX}amix=inputs=$((idx + 1)):normalize=0,alimiter=limit=0.95[aout]"

ffmpeg -y -hide_banner -loglevel error \
  "${INPUTS[@]}" \
  -filter_complex "$FILTER" \
  -map 0:v -map "[aout]" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest \
  "$DIR/walkthrough.mp4"

echo "Wrote $DIR/walkthrough.mp4"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$DIR/walkthrough.mp4"
