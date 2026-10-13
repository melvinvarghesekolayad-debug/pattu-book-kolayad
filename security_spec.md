# Security Specification for WorkLog Pro

## Data Invariants
1. **WorkLog**:
   - Any client can create a work log entry to allow worker submissions without tedious login.
   - Creating a work log requires all keys to be strictly defined. No shadow or ghost keys.
   - All fields must be typed correctly. All expense figures (`vehicleRent`, `foodExpense`, `toolsRent`, `otherExpense`) must be positive numbers.
   - Document ID must be a valid, standard alphanumeric string.
   - `createdAt` and `updatedAt` must match the server timestamp (`request.time`).
   - Only authenticated users (the owner) can read, update, or delete work logs.
2. **Settings**:
   - Only authenticated users can read or write settings.

## The "Dirty Dozen" Payloads (Expected to be REJECTED)
1. **Ghost Field Attack**: Attempt to create a work log with `isVerified: true`.
2. **Negative Expense**: Attempt to create a work log with `vehicleRent: -500`.
3. **Invalid Phone Type**: Attempt to create a work log with `workerPhone: 9876543210` (number instead of string).
4. **Invalid Phone Format**: Attempt to create a work log with `workerPhone: "abc"`.
5. **Junk ID Poisoning**: Attempt to write with a document ID of 1000 characters.
6. **Spoofed CreatedAt**: Attempt to create a work log with `createdAt` set to a hardcoded past/future timestamp.
7. **Missing Required Fields**: Attempt to create a work log without the `workDescription` field.
8. **Unauthorized Read**: Attempt to read the entire list of `work_logs` without being authenticated.
9. **Unauthorized Settings Write**: Attempt to write to `/settings/global` without being logged in.
10. **Unauthorized Delete**: Attempt to delete a work log entry as an anonymous unauthenticated user.
11. **Type Mismatch on SiteName**: Attempt to write a work log where `siteName` is an array.
12. **Out of Range String Size**: Attempt to write a work description that exceeds 1000 characters.

## Test Conditions (Verifiable via Firestore rules)
- `create` on `/work_logs/{logId}`: `allow create: if isValidWorkLog(request.resource.data);`
- `read`/`write` on `/settings/{settingsId}`: `allow read, write: if request.auth != null;`
- `read`/`update`/`delete` on `/work_logs/{logId}`: `allow read, update, delete: if request.auth != null;`
