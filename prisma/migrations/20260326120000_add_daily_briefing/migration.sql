-- CreateTable
CREATE TABLE DailyBriefing (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    briefingDate TEXT NOT NULL,
    data TEXT NOT NULL,
    generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refreshCount INTEGER NOT NULL DEFAULT 0,
    isFromCache BOOLEAN NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX DailyBriefing_userId_briefingDate_key ON DailyBriefing(userId, briefingDate);

CREATE INDEX DailyBriefing_userId_idx ON DailyBriefing(userId);
