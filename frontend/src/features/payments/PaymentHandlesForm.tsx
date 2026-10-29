import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getCurrentUserOptions,
  getCurrentUserQueryKey,
  updateCurrentUserMutation,
} from '../../api/@tanstack/react-query.gen';

const FIELDS = [
  { key: 'upiVpa', label: 'UPI ID', placeholder: 'name@bank' },
  { key: 'paypalMe', label: 'PayPal.me', placeholder: 'handle' },
  { key: 'venmoHandle', label: 'Venmo', placeholder: 'username' },
] as const;

type Handles = Record<(typeof FIELDS)[number]['key'], string>;

/** Where friends can pay you. Everything is optional; blank clears it. */
export function PaymentHandlesForm() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(getCurrentUserOptions());
  const [values, setValues] = useState<Handles>({ upiVpa: '', paypalMe: '', venmoHandle: '' });

  useEffect(() => {
    if (me) {
      setValues({
        upiVpa: me.upiVpa ?? '',
        paypalMe: me.paypalMe ?? '',
        venmoHandle: me.venmoHandle ?? '',
      });
    }
  }, [me]);

  const save = useMutation({
    ...updateCurrentUserMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getCurrentUserQueryKey() });
      toast.success('Payment details saved');
    },
    onError: () => toast.error('Check the format of your payment details'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      body: {
        upiVpa: values.upiVpa.trim() || null,
        paypalMe: values.paypalMe.trim() || null,
        venmoHandle: values.venmoHandle.trim() || null,
      },
    });
  };

  return (
    <form onSubmit={submit} className="glass-panel p-5 rounded-2xl mb-6">
      <h2 className="font-semibold text-text-main">Your payment details</h2>
      <p className="text-sm text-text-muted mb-4">
        Friends who owe you will see buttons to pay you in these apps.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-sm text-text-muted">
            {f.label}
            <input
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="input-field mt-1 block w-full"
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={save.isPending}
        className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl"
      >
        Save
      </button>
    </form>
  );
}
