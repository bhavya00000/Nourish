-- CreateTable
CREATE TABLE "AiSetting" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'groq',
    "model" TEXT NOT NULL DEFAULT '',
    "visionModel" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKeyEnc" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'full',
    "muscles" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT NOT NULL DEFAULT 'bodyweight',
    "isCardio" BOOLEAN NOT NULL DEFAULT false,
    "met" REAL NOT NULL DEFAULT 5,
    "source" TEXT NOT NULL DEFAULT 'builtin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'strength',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "kcal" REAL NOT NULL DEFAULT 0,
    "rpe" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "rawText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "setNumber" INTEGER NOT NULL DEFAULT 1,
    "reps" INTEGER,
    "weightKg" REAL,
    "distanceKm" REAL,
    "durationMin" REAL,
    "rpe" INTEGER,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "kcal" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "WorkoutSet_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "focus" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "reps" INTEGER,
    "weightKg" REAL,
    "durationMin" REAL,
    CONSTRAINT "RoutineItem_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutineItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "age" INTEGER,
    "sex" TEXT,
    "heightCm" REAL,
    "weightKg" REAL,
    "jobRole" TEXT NOT NULL DEFAULT 'desk',
    "gymType" TEXT NOT NULL DEFAULT 'none',
    "gymDays" INTEGER NOT NULL DEFAULT 0,
    "walkMinutes" INTEGER NOT NULL DEFAULT 0,
    "dietType" TEXT NOT NULL DEFAULT 'veg',
    "cuisines" TEXT NOT NULL DEFAULT 'indian',
    "allergies" TEXT NOT NULL DEFAULT '',
    "dislikes" TEXT NOT NULL DEFAULT '',
    "extraInfo" TEXT NOT NULL DEFAULT '',
    "adaptiveTdee" BOOLEAN NOT NULL DEFAULT true,
    "learnedTdee" REAL,
    "learnedAt" DATETIME,
    "eatingWindowH" INTEGER NOT NULL DEFAULT 12,
    "useLoggedWorkouts" BOOLEAN NOT NULL DEFAULT false,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("adaptiveTdee", "age", "allergies", "cuisines", "dietType", "dislikes", "eatingWindowH", "extraInfo", "gymDays", "gymType", "heightCm", "jobRole", "learnedAt", "learnedTdee", "sex", "units", "updatedAt", "userId", "walkMinutes", "weightKg") SELECT "adaptiveTdee", "age", "allergies", "cuisines", "dietType", "dislikes", "eatingWindowH", "extraInfo", "gymDays", "gymType", "heightCm", "jobRole", "learnedAt", "learnedTdee", "sex", "units", "updatedAt", "userId", "walkMinutes", "weightKg" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Exercise_userId_idx" ON "Exercise"("userId");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "Workout_userId_date_idx" ON "Workout"("userId", "date");

-- CreateIndex
CREATE INDEX "WorkoutSet_workoutId_idx" ON "WorkoutSet"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutSet_exerciseId_idx" ON "WorkoutSet"("exerciseId");

-- CreateIndex
CREATE INDEX "Routine_userId_idx" ON "Routine"("userId");

-- CreateIndex
CREATE INDEX "RoutineItem_routineId_idx" ON "RoutineItem"("routineId");
