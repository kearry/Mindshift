/*
  Warnings:

  - You are about to drop the `auth_providers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_achievements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `argument_text` on the `arguments` table. All the data in the column will be lost.
  - You are about to drop the column `shift_reasoning` on the `arguments` table. All the data in the column will be lost.
  - You are about to drop the column `comment_text` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `parent_comment_id` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `debates` table. All the data in the column will be lost.
  - You are about to drop the column `summary_article` on the `debates` table. All the data in the column will be lost.
  - You are about to drop the column `debateCount` on the `topics` table. All the data in the column will be lost.
  - You are about to drop the column `isSponsored` on the `topics` table. All the data in the column will be lost.
  - You are about to drop the column `sponsorId` on the `topics` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLogin` on the `users` table. All the data in the column will be lost.
  - Added the required column `argumentText` to the `arguments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commentText` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Made the column `debateId` on table `comments` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `debates` table without a default value. This is not possible if the table is not empty.
  - Made the column `content` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "auth_providers_providerName_providerUserId_key";

-- DropIndex
DROP INDEX "user_achievements_userId_achievementId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "auth_providers";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sessions";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_achievements";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_arguments" (
    "argumentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "debateId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "argumentText" TEXT NOT NULL,
    "aiResponse" TEXT,
    "stanceBefore" REAL NOT NULL,
    "stanceAfter" REAL,
    "stanceShift" REAL,
    "shiftReasoning" TEXT,
    CONSTRAINT "arguments_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates" ("debateId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "arguments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_arguments" ("aiResponse", "argumentId", "createdAt", "debateId", "stanceAfter", "stanceBefore", "stanceShift", "turnNumber", "userId") SELECT "aiResponse", "argumentId", "createdAt", "debateId", "stanceAfter", "stanceBefore", "stanceShift", "turnNumber", "userId" FROM "arguments";
DROP TABLE "arguments";
ALTER TABLE "new_arguments" RENAME TO "arguments";
CREATE INDEX "arguments_debateId_idx" ON "arguments"("debateId");
CREATE TABLE "new_comments" (
    "commentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "commentText" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "debateId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates" ("debateId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments" ("commentId") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_comments" ("commentId", "createdAt", "debateId", "isDeleted", "updatedAt", "userId") SELECT "commentId", "createdAt", "debateId", "isDeleted", "updatedAt", "userId" FROM "comments";
DROP TABLE "comments";
ALTER TABLE "new_comments" RENAME TO "comments";
CREATE INDEX "comments_userId_idx" ON "comments"("userId");
CREATE INDEX "comments_debateId_idx" ON "comments"("debateId");
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");
CREATE TABLE "new_debates" (
    "debateId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "initialStance" REAL NOT NULL,
    "finalStance" REAL,
    "goalDirection" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "maxTurns" INTEGER NOT NULL DEFAULT 5,
    "pointsEarned" REAL,
    "summaryArticle" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "debates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debates_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics" ("topicId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_debates" ("completedAt", "createdAt", "debateId", "finalStance", "goalDirection", "initialStance", "maxTurns", "pointsEarned", "status", "topicId", "turnCount", "userId") SELECT "completedAt", "createdAt", "debateId", "finalStance", "goalDirection", "initialStance", "maxTurns", "pointsEarned", "status", "topicId", "turnCount", "userId" FROM "debates";
DROP TABLE "debates";
ALTER TABLE "new_debates" RENAME TO "debates";
CREATE INDEX "debates_userId_idx" ON "debates"("userId");
CREATE INDEX "debates_topicId_idx" ON "debates"("topicId");
CREATE TABLE "new_notifications" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "notificationType" TEXT NOT NULL,
    "relatedUserId" INTEGER,
    "relatedDebateId" INTEGER,
    "relatedCommentId" INTEGER,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "users" ("userId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_relatedDebateId_fkey" FOREIGN KEY ("relatedDebateId") REFERENCES "debates" ("debateId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_relatedCommentId_fkey" FOREIGN KEY ("relatedCommentId") REFERENCES "comments" ("commentId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notifications" ("content", "createdAt", "isRead", "notificationId", "notificationType", "relatedCommentId", "relatedDebateId", "relatedUserId", "userId") SELECT "content", "createdAt", "isRead", "notificationId", "notificationType", "relatedCommentId", "relatedDebateId", "relatedUserId", "userId" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_relatedUserId_idx" ON "notifications"("relatedUserId");
CREATE INDEX "notifications_relatedDebateId_idx" ON "notifications"("relatedDebateId");
CREATE TABLE "new_topics" (
    "topicId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "currentStance" REAL NOT NULL,
    "stanceReasoning" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scaleDefinitions" JSONB
);
INSERT INTO "new_topics" ("category", "createdAt", "currentStance", "description", "isActive", "name", "stanceReasoning", "topicId", "updatedAt") SELECT "category", "createdAt", "currentStance", "description", "isActive", "name", "stanceReasoning", "topicId", "updatedAt" FROM "topics";
DROP TABLE "topics";
ALTER TABLE "new_topics" RENAME TO "topics";
CREATE UNIQUE INDEX "topics_name_key" ON "topics"("name");
CREATE TABLE "new_users" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rank" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_users" ("bio", "createdAt", "displayName", "email", "isActive", "isAdmin", "passwordHash", "profileImageUrl", "rank", "totalPoints", "userId", "username") SELECT "bio", "createdAt", "displayName", "email", "isActive", "isAdmin", "passwordHash", "profileImageUrl", "rank", "totalPoints", "userId", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
