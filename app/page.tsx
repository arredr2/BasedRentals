'use client';

import { useState, useEffect } from 'react';
import { WalletDefault } from '@coinbase/onchainkit/wallet';
import { useWalletClient } from 'wagmi';
import { 
  useBalance,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2 } from 'lucide-react';

// Contract ABIs
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const RENTAL_ABI = [
  "function getRental(uint256 _rentalId) external view returns (address landlord, address tenant, string propertyDetails, uint256 monthlyRent, uint256 startDate, uint256 endDate, uint256 nextPaymentDue, bool isActive)",
  "function payRent(uint256 _rentalId) external",
  "function getRentalCount() external view returns (uint256)"
];

// Contract addresses (you'll need to update these)
const RENTAL_CONTRACT_ADDRESS = "0x365252AfA7B1Dfa822aB6bD20804EBb8fC9A1c86" as `0x${string}`; // Replace with your actual deployed address
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

// Define the type for currentRental
interface Rental {
  landlord: string;
  tenant: string;
  propertyDetails: string;
  monthlyRent: number; // Ensure this is the correct type
  startDate: Date;
  endDate: Date;
  nextPaymentDue: Date;
  isActive: boolean;
}

// Define the type for rental details
interface RentalDetails {
  landlord: string;
  tenant: string;
  propertyDetails: string;
  monthlyRent: number;
  startDate: Date;
  endDate: Date;
  nextPaymentDue: Date;
  isActive: boolean;
}

export default function Page() {
  const { data: walletClient } = useWalletClient();
  const address = walletClient?.account.address;
  const isConnected = !!address;
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [currentRental, setCurrentRental] = useState<Rental | null>(null);
  
  // Contract reads
  const { data: rentalCount } = useReadContract({
    address: RENTAL_CONTRACT_ADDRESS,
    abi: RENTAL_ABI,
    functionName: 'getRentalCount',
  });

  // Conditionally read rental details only if rentalCount is available and greater than 0
  const rentalCountValue = rentalCount as number; // Type assertion

  const { data: rentalDetails } = rentalCountValue && rentalCountValue > 0 
    ? useReadContract({
        address: RENTAL_CONTRACT_ADDRESS,
        abi: RENTAL_ABI,
        functionName: 'getRental',
        args: [0], // Getting first rental for demo
      })
    : { data: null }; // Fallback if rentalCount is not valid

  // Ensure rentalDetails is typed correctly
  const rentalDetailsTyped = rentalDetails as unknown as RentalDetails; // Type assertion

  // Contract writes
  const { writeContract: approveUSDC } = useWriteContract();
  const { writeContract: payRent } = useWriteContract();

  const handlePayment = async () => {
    if (!currentRental || !address) return;

    try {
      setPaymentStatus('approving');
      
      // First approve USDC
      await approveUSDC({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [RENTAL_CONTRACT_ADDRESS, currentRental.monthlyRent],
      });

      setPaymentStatus('paying');
      
      // Then make the payment
      await payRent({
        address: RENTAL_CONTRACT_ADDRESS,
        abi: RENTAL_ABI,
        functionName: 'payRent',
        args: [0], // Rental ID 0 for demo
      });

      setPaymentStatus('success');
    } catch (error) {
      console.error('Payment failed:', error);
      setPaymentStatus('error');
    }
  };

  useEffect(() => {
    if (rentalDetails) {
      setCurrentRental({
        landlord: rentalDetailsTyped.landlord,
        tenant: rentalDetailsTyped.tenant,
        propertyDetails: rentalDetailsTyped.propertyDetails,
        monthlyRent: rentalDetailsTyped.monthlyRent,
        startDate: new Date(Number(rentalDetailsTyped.startDate) * 1000),
        endDate: new Date(Number(rentalDetailsTyped.endDate) * 1000),
        nextPaymentDue: new Date(Number(rentalDetailsTyped.nextPaymentDue) * 1000),
        isActive: rentalDetailsTyped.isActive,
      });
    }
  }, [rentalDetails]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4">
          <WalletDefault />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-6 w-6" />
              Rental Payment Portal
            </CardTitle>
            <CardDescription>
              Manage your rental payments securely on Base
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {currentRental && (
              <>
                {/* Property Details */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Property Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Property</Label>
                      <p className="text-sm text-gray-600">
                        {currentRental.propertyDetails}
                      </p>
                    </div>
                    <div>
                      <Label>Monthly Rent</Label>
                      <p className="text-sm text-gray-600">
                        {Number(currentRental.monthlyRent) / 1e6} USDC
                      </p>
                    </div>
                    <div>
                      <Label>Next Payment Due</Label>
                      <p className="text-sm text-gray-600">
                        {currentRental.nextPaymentDue.toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <p className="text-sm text-gray-600">
                        {currentRental.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Status */}
                {paymentStatus === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Payment failed. Please try again.
                    </AlertDescription>
                  </Alert>
                )}

                {paymentStatus === 'success' && (
                  <Alert>
                    <AlertDescription>
                      Payment successful!
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>

          <CardFooter>
            <Button 
              onClick={handlePayment} 
              className="w-full"
              disabled={!isConnected || paymentStatus === 'approving' || paymentStatus === 'paying' || !currentRental?.isActive}
            >
              {(paymentStatus === 'approving' || paymentStatus === 'paying') && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {!isConnected ? 'Connect Wallet to Pay' : 
               paymentStatus === 'approving' ? 'Approving USDC...' :
               paymentStatus === 'paying' ? 'Processing Payment...' :
               'Pay Rent'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
