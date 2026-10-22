// Seed exercise database.
// One compact row per exercise:
//   [ name, aliases("|"), category, muscles("|"), equipment, isCardio, MET ]
// MET is the metabolic equivalent used to estimate calories from bodyweight
// and time. Strength values are for working sets including rest.

export type SeedExercise = {
  name: string;
  aliases: string[];
  category: string;
  muscles: string[];
  equipment: string;
  isCardio: boolean;
  met: number;
};

type Row = [string, string, string, string, string, number, number];

const ROWS: Row[] = [
  // ---------------- push
  ["Barbell Bench Press", "bench|bench press|flat bench|bp", "push", "chest|triceps|front delts", "barbell", 0, 6],
  ["Incline Barbell Bench Press", "incline bench|incline press", "push", "upper chest|triceps|front delts", "barbell", 0, 6],
  ["Dumbbell Bench Press", "db bench|dumbbell press|db press", "push", "chest|triceps", "dumbbell", 0, 5.5],
  ["Incline Dumbbell Press", "incline db press|incline dumbbell", "push", "upper chest|front delts", "dumbbell", 0, 5.5],
  ["Overhead Press", "ohp|shoulder press|military press|standing press", "push", "shoulders|triceps", "barbell", 0, 6],
  ["Dumbbell Shoulder Press", "db shoulder press|seated db press", "push", "shoulders|triceps", "dumbbell", 0, 5.5],
  ["Push-Up", "pushup|push ups|pushups", "push", "chest|triceps|core", "bodyweight", 0, 4],
  ["Dip", "dips|parallel bar dip|chest dip", "push", "chest|triceps", "bodyweight", 0, 5],
  ["Cable Chest Fly", "cable fly|pec fly|chest fly|pec deck", "push", "chest", "cable", 0, 4],
  ["Lateral Raise", "side raise|lateral raises|db lateral", "push", "side delts", "dumbbell", 0, 3.5],
  ["Front Raise", "front raises", "push", "front delts", "dumbbell", 0, 3.5],
  ["Triceps Pushdown", "tricep pushdown|pushdown|rope pushdown", "push", "triceps", "cable", 0, 3.5],
  ["Skull Crusher", "skullcrusher|lying tricep extension", "push", "triceps", "barbell", 0, 4],
  ["Overhead Triceps Extension", "tricep extension|overhead extension", "push", "triceps", "dumbbell", 0, 3.5],
  ["Machine Chest Press", "chest press machine|machine press", "push", "chest|triceps", "machine", 0, 5],

  // ---------------- pull
  ["Deadlift", "deadlifts|conventional deadlift|dl", "pull", "back|glutes|hamstrings", "barbell", 0, 7],
  ["Romanian Deadlift", "rdl|romanian dl|stiff leg deadlift", "pull", "hamstrings|glutes|back", "barbell", 0, 6],
  ["Pull-Up", "pullup|pull ups|pullups", "pull", "lats|biceps", "bodyweight", 0, 5],
  ["Chin-Up", "chinup|chin ups|chinups", "pull", "lats|biceps", "bodyweight", 0, 5],
  ["Lat Pulldown", "pulldown|lat pull down|latpulldown", "pull", "lats|biceps", "machine", 0, 4.5],
  ["Barbell Row", "bent over row|bb row|barbell rows|rows", "pull", "back|biceps", "barbell", 0, 6],
  ["Dumbbell Row", "db row|one arm row|single arm row", "pull", "back|biceps", "dumbbell", 0, 5],
  ["Seated Cable Row", "cable row|seated row", "pull", "back|biceps", "cable", 0, 4.5],
  ["Face Pull", "face pulls", "pull", "rear delts|upper back", "cable", 0, 3.5],
  ["Barbell Curl", "barbell curls|bb curl|ez bar curl", "pull", "biceps", "barbell", 0, 3.5],
  ["Dumbbell Curl", "bicep curl|biceps curl|db curl|dumbbell curls|curls|curl", "pull", "biceps", "dumbbell", 0, 3.5],
  ["Hammer Curl", "hammer curls", "pull", "biceps|forearms", "dumbbell", 0, 3.5],
  ["Shrug", "shrugs|barbell shrug", "pull", "traps", "barbell", 0, 4],
  ["Machine Row", "row machine|hammer strength row", "pull", "back|biceps", "machine", 0, 4.5],

  // ---------------- legs
  ["Barbell Back Squat", "squat|squats|back squat|bb squat", "legs", "quads|glutes|core", "barbell", 0, 6.5],
  ["Front Squat", "front squats", "legs", "quads|core", "barbell", 0, 6.5],
  ["Goblet Squat", "goblet squats", "legs", "quads|glutes", "dumbbell", 0, 5],
  ["Leg Press", "legpress|leg press machine", "legs", "quads|glutes", "machine", 0, 5.5],
  ["Lunge", "lunges|walking lunge|dumbbell lunge", "legs", "quads|glutes", "dumbbell", 0, 5],
  ["Bulgarian Split Squat", "split squat|bulgarian", "legs", "quads|glutes", "dumbbell", 0, 5.5],
  ["Leg Extension", "leg extensions|quad extension", "legs", "quads", "machine", 0, 4],
  ["Leg Curl", "hamstring curl|leg curls|lying leg curl", "legs", "hamstrings", "machine", 0, 4],
  ["Hip Thrust", "hip thrusts|glute bridge", "legs", "glutes|hamstrings", "barbell", 0, 5],
  ["Calf Raise", "calf raises|standing calf raise", "legs", "calves", "machine", 0, 3.5],
  ["Step-Up", "step ups|box step up", "legs", "quads|glutes", "dumbbell", 0, 5],

  // ---------------- core
  ["Plank", "planks|front plank", "core", "core", "bodyweight", 0, 3],
  ["Side Plank", "side planks", "core", "obliques|core", "bodyweight", 0, 3],
  ["Crunch", "crunches|sit up|situps|sit ups", "core", "abs", "bodyweight", 0, 3.5],
  ["Hanging Leg Raise", "leg raise|leg raises|hanging knee raise", "core", "abs|hip flexors", "bodyweight", 0, 4],
  ["Russian Twist", "russian twists", "core", "obliques", "bodyweight", 0, 4],
  ["Cable Crunch", "cable crunches|kneeling crunch", "core", "abs", "cable", 0, 3.5],
  ["Mountain Climber", "mountain climbers", "core", "core|shoulders", "bodyweight", 0, 8],
  ["Ab Wheel Rollout", "ab wheel|ab roller", "core", "abs|core", "bodyweight", 0, 4],

  // ---------------- cardio
  ["Running", "run|jogging|jog|treadmill run", "cardio", "full body", "none", 1, 9.8],
  ["Treadmill Walking", "treadmill walk|incline walk", "cardio", "legs", "machine", 1, 4.3],
  ["Walking", "walk|brisk walk", "cardio", "legs", "none", 1, 3.5],
  ["Cycling", "cycle|bike|biking|stationary bike|spin", "cardio", "legs", "machine", 1, 7.5],
  ["Elliptical", "cross trainer|elliptical trainer", "cardio", "full body", "machine", 1, 5.5],
  ["Rowing Machine", "rowing|rower|erg|row machine cardio", "cardio", "full body", "machine", 1, 7],
  ["Stair Climber", "stairmaster|stair master|stairs", "cardio", "legs", "machine", 1, 9],
  ["Swimming", "swim|swimming laps", "cardio", "full body", "none", 1, 8.3],
  ["Skipping", "jump rope|skipping rope|rope jumping", "cardio", "full body", "none", 1, 11],
  ["HIIT", "hiit|interval training|circuit", "cardio", "full body", "none", 1, 10],
  ["Burpee", "burpees", "cardio", "full body", "bodyweight", 1, 8],
  ["Football", "soccer|football match", "cardio", "full body", "none", 1, 8],
  ["Cricket", "cricket match", "cardio", "full body", "none", 1, 5],
  ["Badminton", "badminton match", "cardio", "full body", "none", 1, 5.5],
  ["Basketball", "basketball game", "cardio", "full body", "none", 1, 8],
  ["Boxing", "boxing|kickboxing|bag work", "cardio", "full body", "none", 1, 9],

  // ---------------- mobility
  ["Yoga", "yoga session|hatha yoga", "mobility", "full body", "none", 1, 3],
  ["Stretching", "stretch|stretching session|cool down", "mobility", "full body", "none", 1, 2.3],
  ["Foam Rolling", "foam roll|myofascial release", "mobility", "full body", "none", 1, 2],
  ["Pilates", "pilates class", "mobility", "core|full body", "none", 1, 3.5],

  // ---------------- full body / olympic
  ["Kettlebell Swing", "kb swing|kettlebell swings", "full", "glutes|hamstrings|core", "kettlebell", 0, 8],
  ["Clean and Press", "clean press|power clean", "full", "full body", "barbell", 0, 8],
  ["Thruster", "thrusters", "full", "full body", "barbell", 0, 8],
  ["Farmer's Carry", "farmers walk|farmer carry|loaded carry", "full", "grip|core|traps", "dumbbell", 0, 5],
  ["Battle Ropes", "battle rope|ropes", "full", "full body", "none", 1, 8],
];

export const SEED_EXERCISES: SeedExercise[] = ROWS.map(
  ([name, aliases, category, muscles, equipment, isCardio, met]) => ({
    name,
    aliases: aliases ? aliases.split("|").filter(Boolean) : [],
    category,
    muscles: muscles ? muscles.split("|").filter(Boolean) : [],
    equipment,
    isCardio: Boolean(isCardio),
    met,
  })
);
