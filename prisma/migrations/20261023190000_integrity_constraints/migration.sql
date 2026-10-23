-- Contraintes d'intégrité non exprimables dans le schéma Prisma.

-- Le solde d'un portefeuille ne peut jamais être négatif.
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_balance_nonnegative" CHECK ("balance" >= 0);

-- Une écriture du registre a toujours un montant non nul et un solde résultant positif ou nul.
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_amount_nonzero" CHECK ("amount" <> 0);
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_balance_nonnegative" CHECK ("balanceAfter" >= 0);

-- Signe cohérent avec le type d'opération.
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_sign_by_type" CHECK (
  ("type" IN ('WELCOME', 'PURCHASE', 'RESTITUTION') AND "amount" > 0)
  OR ("type" IN ('UNLOCK', 'PAYMENT_REVERSAL') AND "amount" < 0)
  OR ("type" = 'ADMIN_ADJUSTMENT')
);

-- Plafond strict d'entreprises par demande.
ALTER TABLE "Request" ADD CONSTRAINT "Request_unlock_cap" CHECK ("unlockCount" >= 0 AND "unlockCount" <= "maxUnlocks");
ALTER TABLE "Request" ADD CONSTRAINT "Request_max_unlocks_range" CHECK ("maxUnlocks" BETWEEN 1 AND 10);

-- Le registre est en écriture seule : ni modification ni suppression.
CREATE OR REPLACE FUNCTION ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CreditLedgerEntry est en écriture seule';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CreditLedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "CreditLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();

-- Achats : montants cohérents.
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_amounts" CHECK ("priceTtcCents" = "priceHtCents" + "vatCents" AND "credits" > 0);
