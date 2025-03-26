/*
  Warnings:

  - The primary key for the `sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `sessionId` on the `sessions` table. All the data in the column will be lost.
  - Added the required column `argument_text` to the `arguments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stanceBefore` to the `arguments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turnNumber` to the `arguments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `comment_text` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `goalDirection` to the `debates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initialStance` to the `debates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notificationType` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session_id` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_arguments" (
    "argumentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "debateId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "argument_text" TEXT NOT NULL,
    "aiResponse" TEXT,
    "stanceBefore" REAL NOT NULL,
    "stanceAfter" REAL,
    "stanceShift" REAL,
    "shift_reasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arguments_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates" ("debateId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "arguments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_arguments" ("argumentId", "debateId", "userId") SELECT "argumentId", "debateId", "userId" FROM "arguments";
DROP TABLE "arguments";
ALTER TABLE "new_arguments" RENAME TO "arguments";
CREATE TABLE "new_comments" (
    "commentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "debateId" INTEGER,
    "userId" INTEGER NOT NULL,
    "parent_comment_id" INTEGER,
    "comment_text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "comments_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates" ("debateId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments" ("commentId") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_comments" ("commentId", "debateId", "parent_comment_id", "userId") SELECT "commentId", "debateId", "parent_comment_id", "userId" FROM "comments";
DROP TABLE "comments";
ALTER TABLE "new_comments" RENAME TO "comments";
CREATE TABLE "new_debates" (
    "debateId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "initialStance" REAL NOT NULL,
    "finalStance" REAL,
    "goalDirection" TEXT NOT NULL,
    "pointsEarned" REAL,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "maxTurns" INTEGER NOT NULL DEFAULT 7,
    "status" TEXT NOT NULL DEFAULT 'active',
    "summary_article" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "debates_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics" ("topicId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "debates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_debates" ("debateId", "topicId", "userId") SELECT "debateId", "topicId", "userId" FROM "debates";
DROP TABLE "debates";
ALTER TABLE "new_debates" RENAME TO "debates";
CREATE TABLE "new_notifications" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "notificationType" TEXT NOT NULL,
    "content" TEXT,
    "relatedUserId" INTEGER,
    "relatedDebateId" INTEGER,
    "relatedCommentId" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notifications" ("notificationId", "userId") SELECT "notificationId", "userId" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
CREATE TABLE "new_sessions" (
    "session_id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "user_agent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("userId") SELECT "userId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
