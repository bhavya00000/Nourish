-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "waistCm" REAL,
    "chestCm" REAL,
    "hipsCm" REAL,
    "armCm" REAL,
    "thighCm" REAL,
    "bodyFatPct" REAL,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Measurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "DayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DayLog" ("date", "id", "mood", "note", "userId", "waterMl") SELECT "date", "id", "mood", "note", "userId", "waterMl" FROM "DayLog";
DROP TABLE "DayLog";
ALTER TABLE "new_DayLog" RENAME TO "DayLog";
CREATE UNIQUE INDEX "DayLog_userId_date_key" ON "DayLog"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Measurement_userId_idx" ON "Measurement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_userId_date_key" ON "Measurement"("userId", "date");
