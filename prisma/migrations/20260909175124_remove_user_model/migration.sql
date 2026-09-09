-- Remove the orphaned `User` model. It predates the app's real auth layer,
-- which runs entirely on `Employee` (login = employee code + PIN, Session ->
-- Employee, every module's actor id is an Employee id). Nothing read or wrote
-- `User` except its own CRUD module, which is removed alongside this.

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "UserRole";
