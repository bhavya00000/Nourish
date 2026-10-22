-- CreateTable
CREATE TABLE "HealthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "workouts" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DayLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "waterMl" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "mood" TEXT NOT NULL DEFAULT '',
    "steps" INTEGER NOT NULL DEFAULT 0,
    "sleepHours" REAL NOT NULL DEFAULT 0,
    "activeKcal" REAL,
    "restingKcal" REAL,
    "restingHr" REAL,
    "distanceKm" REAL,
    "healthSource" TEXT NOT NULL DEFAULT '',
    "syncedAt" DATETIME,
    CONSTRAINT "DayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DayLog" ("date", "id", "mood", "note", "sleepHours", "steps", "userId", "waterMl") SELECT "date", "id", "mood", "note", "sleepHours", "steps", "userId", "waterMl" FROM "DayLog";
DROP TABLE "DayLog";
ALTER TABLE "new_DayLog" RENAME TO "DayLog";
CREATE UNIQUE INDEX "DayLog_userId_date_key" ON "DayLog"("userId", "date");
CREATE TABLE "new_Workout" (
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
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "distanceKm" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Workout" ("createdAt", "date", "durationMin", "id", "kcal", "name", "notes", "rawText", "rpe", "startedAt", "type", "userId") SELECT "createdAt", "date", "durationMin", "id", "kcal", "name", "notes", "rawText", "rpe", "startedAt", "type", "userId" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE INDEX "Workout_userId_date_idx" ON "Workout"("userId", "date");
CREATE UNIQUE INDEX "Workout_userId_externalId_key" ON "Workout"("userId", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "HealthToken_tokenHash_key" ON "HealthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "HealthToken_userId_idx" ON "HealthToken"("userId");

-- CreateIndex
CREATE INDEX "HealthSync_userId_createdAt_idx" ON "HealthSync"("userId", "createdAt");
