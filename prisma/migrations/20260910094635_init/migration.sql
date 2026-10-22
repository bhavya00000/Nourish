-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Profile" (
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
    "units" TEXT NOT NULL DEFAULT 'metric',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "goalType" TEXT NOT NULL DEFAULT 'maintain',
    "targetWeight" REAL,
    "targetWeeks" INTEGER NOT NULL DEFAULT 24,
    "startWeight" REAL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customCalories" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '',
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL DEFAULT 0,
    "carbs" REAL NOT NULL DEFAULT 0,
    "fat" REAL NOT NULL DEFAULT 0,
    "fiber" REAL NOT NULL DEFAULT 0,
    "sugar" REAL NOT NULL DEFAULT 0,
    "sodium" REAL NOT NULL DEFAULT 0,
    "units" TEXT NOT NULL DEFAULT 'g:1',
    "veg" BOOLEAN NOT NULL DEFAULT true,
    "cuisine" TEXT NOT NULL DEFAULT 'other',
    "tags" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'builtin',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Food_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'recipe',
    "meal" TEXT,
    "servings" REAL NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "foodId" TEXT,
    "date" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "rawText" TEXT NOT NULL DEFAULT '',
    "foodName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL DEFAULT 0,
    "carbs" REAL NOT NULL DEFAULT 0,
    "fat" REAL NOT NULL DEFAULT 0,
    "fiber" REAL NOT NULL DEFAULT 0,
    "sugar" REAL NOT NULL DEFAULT 0,
    "sodium" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'builtin',
    "eatenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Entry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "waterMl" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "mood" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "DayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Food_userId_idx" ON "Food"("userId");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");

-- CreateIndex
CREATE INDEX "RecipeItem_recipeId_idx" ON "RecipeItem"("recipeId");

-- CreateIndex
CREATE INDEX "Entry_userId_date_idx" ON "Entry"("userId", "date");

-- CreateIndex
CREATE INDEX "WeightLog_userId_idx" ON "WeightLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeightLog_userId_date_key" ON "WeightLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayLog_userId_date_key" ON "DayLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_key_key" ON "Achievement"("userId", "key");
