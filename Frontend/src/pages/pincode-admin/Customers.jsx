import React from 'react';
import { CustomersView } from '../../components/CustomersView';

export function PincodeCustomers() {
  return (
    <CustomersView
      title="Pincode Customer Directory"
      subtitle="All registered customers within assigned pincode jurisdiction • Sorted by newest registrations first"
    />
  );
}
