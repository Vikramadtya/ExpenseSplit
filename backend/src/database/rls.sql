-- ExpenseSplit SaaS: PostgreSQL Row-Level Security (RLS) Policies
-- This script enables strict tenant isolation by workspace_id.

-- 1. Enable RLS on all domain tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- 2. Define standard policies for tenant isolation
-- The application must set the `app.current_workspace_id` and `app.current_user_id` session variables 
-- at the start of every transaction.

-- WORKSPACES
-- A user can only see workspaces they are a member of.
CREATE POLICY workspace_isolation_policy ON workspaces
  FOR ALL
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = current_setting('app.current_user_id', true)::uuid));

-- GROUPS
-- Groups are isolated by the current workspace context.
CREATE POLICY group_isolation_policy ON groups
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);

-- EXPENSES
CREATE POLICY expense_isolation_policy ON expenses
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);

-- EXPENSE SPLITS
CREATE POLICY expense_splits_isolation_policy ON expense_splits
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);

-- SETTLEMENTS
CREATE POLICY settlements_isolation_policy ON settlements
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);

-- GROUP MEMBERS
CREATE POLICY group_members_isolation_policy ON group_members
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
