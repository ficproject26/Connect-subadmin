import React from 'react';
import { CustomersView } from '../../components/CustomersView';

export function StateCustomers() {
  return (
    <CustomersView
      title="State Customer Directory"
      subtitle="All registered customers within assigned state jurisdiction • Sorted by newest registrations first"
    />
  );
}
