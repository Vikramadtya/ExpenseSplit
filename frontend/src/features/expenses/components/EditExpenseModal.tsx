import React from 'react';
import type { Expense } from '../../../api/types.gen';
import { ExpenseSheet } from './AddExpenseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  workspaceId: string;
}

/** Editing uses the same sheet as adding, so the two always look and behave the same. */
export const EditExpenseModal: React.FC<Props> = ({ isOpen, onClose, expense, workspaceId }) =>
  isOpen && expense ? (
    <ExpenseSheet key={expense.id} expense={expense} onClose={onClose} workspaceId={workspaceId} />
  ) : null;
