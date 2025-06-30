// src/tests/getOrdersToExport.test.ts
import { getOrdersToExport } from '../services/orderService';

const testGetOrdersToExport = async () => {
  try {
    const orders = await getOrdersToExport();
    console.log('Orders to export:', JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Error fetching orders:', error);
  }
};

testGetOrdersToExport();
