import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z
    .number({ invalid_type_error: 'Amount is required' })
    .min(0.01, 'Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  groupId: z.string().min(1, 'Group is required'),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function AddExpenseForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: '',
      groupId: '',
    },
  });

  const onSubmit = (data: ExpenseFormValues) => {
    console.log('Form Submitted', data);
    alert(`Mock Submitted Expense: ${data.description} for $${data.amount}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border mt-6">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Add Expense</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            {...register('description')}
            className="w-full border rounded p-2"
            placeholder="Dinner, Taxi, etc."
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              {...register('amount', { valueAsNumber: true })}
              className="w-full border rounded p-2"
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" {...register('date')} className="w-full border rounded p-2" />
            {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Group</label>
          <select {...register('groupId')} className="w-full border rounded p-2 bg-white">
            <option value="">Select a Group...</option>
            <option value="g-1">Apartment Expenses</option>
            <option value="g-2">Trip to Hawaii</option>
          </select>
          {errors.groupId && <p className="text-red-500 text-sm mt-1">{errors.groupId.message}</p>}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded p-2 hover:bg-blue-700"
        >
          Save Expense
        </button>
      </form>
    </div>
  );
}
