import React from 'react';
import { CustomersView } from '../../components/CustomersView';

export function DivisionalCustomers() {
  return (
    <CustomersView
      title="Division Customer Directory"
      subtitle="All registered customers within assigned division jurisdiction • Sorted by newest registrations first"
    />
  );
}
