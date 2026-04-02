-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3),
    "sourceIp" TEXT,
    "method" TEXT,
    "url" TEXT,
    "statusCode" INTEGER,
    "userAgent" TEXT,
    "bytesSent" INTEGER,
    "responseTime" DOUBLE PRECISION,
    "rawLine" TEXT NOT NULL,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyReason" TEXT,
    "anomalyScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "threatLevel" TEXT NOT NULL,
    "totalEntries" INTEGER NOT NULL,
    "anomalyCount" INTEGER NOT NULL,
    "topIps" JSONB NOT NULL,
    "statusBreakdown" JSONB NOT NULL,
    "keyFindings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Analysis_uploadId_key" ON "Analysis"("uploadId");
CREATE INDEX "LogEntry_uploadId_idx" ON "LogEntry"("uploadId");
CREATE INDEX "LogEntry_sourceIp_idx" ON "LogEntry"("sourceIp");
CREATE INDEX "LogEntry_timestamp_idx" ON "LogEntry"("timestamp");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
