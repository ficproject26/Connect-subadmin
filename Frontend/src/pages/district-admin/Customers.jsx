import React from 'react';
import { CustomersView } from '../../components/CustomersView';

export function DistrictCustomers() {
  return (
    <CustomersView
      title="District Customer Directory"
      subtitle="All registered customers within assigned district jurisdiction • Sorted by newest registrations first"
    />
  );
}
