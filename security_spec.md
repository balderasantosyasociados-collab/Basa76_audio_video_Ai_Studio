# BASA Studio Firestore Security Specification

## 1. Data Invariants
1. **Strict User Segregation**: Every `UserProfile`, `CreativeProduction`, and `LicenseOrder` inside `/users/{userId}` belongs strictly to `request.auth.uid == userId` with `request.auth.token.email_verified == true`. No user can read, list, create, update, or delete another user's private history.
2. **Payment Entitlement Integrity**: A `CreativeProduction` MUST be created with `isPaid == false` and `licenseTier == 'none'`. Transitioning `isPaid` to `true` is allowed ONLY if `contractSigned == true` and an atomic `LicenseOrder` document (`ord_<productionId>`) is written in the same batch (`existsAfter`).
3. **Contract Immutability**: Once `contractSigned == true` on a `CreativeProduction`, `contractSigned`, `contractSignerName`, `contractDocumentId`, and `contractHash` cannot be reverted or forged by another user.
4. **Public Showcase Isolation**: `/publicCatalog/{productionId}` contains no PII (`email`, `phone`, `address`) and is readable publicly only where `isPublicCatalog == true`, writable strictly by the verified creator whose private `/users/{uid}/productions/{productionId}` document exists.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users/uid1/productions/prod1` -> Denied by Master Gate.
2. Cross-user `list` on `/users/uid2/productions` by `uid1` -> Denied by `request.auth.uid == userId`.
3. Creating `/users/uid1/productions/prod1` with `isPaid: true` on initial create -> Denied (`isPaid == false` required on create).
4. Updating `isPaid: true` without signing the copyright assignment contract (`contractSigned: false`) -> Denied.
5. Updating `isPaid: true` without an atomic `LicenseOrder` at `/users/uid1/orders/ord_prod1` -> Denied by `existsAfter`.
6. Injecting shadow field `isAdmin: true` or `unlimitedDownloads: true` on `UserProfile` or `CreativeProduction` -> Denied by `hasOnly`.
7. Spoofing `ownerId: "other_uid"` inside `/users/uid1/productions/prod1` -> Denied (`ownerId == request.auth.uid`).
8. Unverified email (`email_verified: false`) writing to `/users/uid1/productions/prod1` -> Denied by `isVerifiedUser()`.
9. Client-forged `createdAt` timestamp not equal to `request.time` -> Denied by Temporal Integrity check.
10. Document ID poisoning (`prod!@#` or >128 char ID) -> Denied by `isValidId()`.
11. Mutating `ownerId` or `createdAt` during an `update` -> Denied by Immortal Field rules.
12. Deleting or overwriting another creator's `/publicCatalog/{productionId}` entry -> Denied (`existing().ownerId == request.auth.uid`).
