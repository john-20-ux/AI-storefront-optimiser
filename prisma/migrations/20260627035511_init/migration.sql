-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planName" TEXT NOT NULL DEFAULT 'free',
    "billingStatus" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanSettings" (
    "shopDomain" TEXT NOT NULL,
    "enabledChecks" JSONB NOT NULL DEFAULT '{"seo":true,"altText":true,"description":true,"category":true,"tags":true,"variants":true}',
    "tonePreference" TEXT NOT NULL DEFAULT 'simple',
    "targetAudience" TEXT NOT NULL DEFAULT 'general',
    "aiRule" TEXT NOT NULL DEFAULT 'balanced',
    "autoFixEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ignoredProductIds" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanSettings_pkey" PRIMARY KEY ("shopDomain")
);

-- CreateTable
CREATE TABLE "ScanSummary" (
    "shopDomain" TEXT NOT NULL,
    "lastScanAt" TIMESTAMP(3),
    "totalProductsScanned" INTEGER NOT NULL DEFAULT 0,
    "averageScore" INTEGER NOT NULL DEFAULT 0,
    "issueCounts" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ScanSummary_pkey" PRIMARY KEY ("shopDomain")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
