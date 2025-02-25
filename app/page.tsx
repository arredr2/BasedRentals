import { useState, useEffect } from 'react';
import { WalletDefault } from '@coinbase/onchainkit/wallet';
import { useAccount, useWalletClient } from 'wagmi';
import { 
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits } from 'viem';
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
import { Input } from "@/components/ui/input";
import { Home, Loader2, UserCircle2, Calendar, DollarSign } from 'lucide-react';

// Contract ABIs and addresses
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

const RENTAL_ABI = [
  "function getRental(uint256 _rentalId) external view returns (address landlord, address tenant, string propertyDetails, uint256 monthlyRent, uint256 startDate, uint256 endDate, uint256 nextPaymentDue, bool isActive)",
  "function payRent(uint256 _rentalId) external",
  "function getRentalCount() external view returns (uint256)",
  "function createRental(address _tenant, string calldata _propertyDetails, uint256 _monthlyRent, uint256 _startDate, uint256 _endDate) external returns (uint256)"
];

const RENTAL_CONTRACT_ADDRESS = "0x365252AfA7B1Dfa822aB6bD20804EBb8fC9A1c86";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export default function Page() {
  const { address, isConnected } = useAccount();
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [isLandlord, setIsLandlord] = useState(false);
  const [createRentalMode, setCreateRentalMode] = useState(false);
  const [viewAgreementMode, setViewAgreementMode] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('');
  
  // Default template based on Ozzy's agreement - serves as framework for future agreements
  const [newRentalData, setNewRentalData] = useState({
    tenant: '',
    propertyDetails: '1316 Harrington Avenue, Fort Worth, TX 76164 - Room Rental',
    monthlyRent: '300',
    startDate: '',
    endDate: '',
    increasedRentDate: '',
    increasedRentAmount: '700',
    utilities: ["Water", "Electricity", "Gas", "Internet"].join(", "),
    lateFee: '25'
  });
  
  // Template rental agreement framework based on Ozzy's agreement
  const agreementTemplate = {
    landlord: "Rory Arredondo",
    address: "1316 Harrington Avenue, Fort Worth, TX 76164",
    initialRent: "$300.00 per month",
    increasedRent: "$700.00 per month (after rental period)",
    utilities: ["Water", "Electricity", "Gas", "Internet"],
    dueDate: "1st day of each month",
    lateFee: "$25 if not paid by the 5th day of the month",
    initialTerm: "4 months",
    noticePeriod: "30 days' written notice"
  };

  // Sample tenants - in a real app, this would come from your database
  const tenants = [
    { 
      id: "ozzy",
      name: "Oziel Pineda", 
      startDate: "April 1, 2025",
      endDate: "July 31, 2025",
      increasedRentDate: "August 1, 2025",
      address: "0x" // Replace with actual wallet address
    },
    { 
      id: "tenant2",
      name: "Sample Tenant", 
      startDate: "", 
      endDate: "",
      increasedRentDate: "",
      address: "0x" // Replace with actual wallet address
    }
  ];
  
  // Get tenant details for display
  const getAgreementDetails = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId) || tenants[0];
    
    return {
      landlord: agreementTemplate.landlord,
      tenant: tenant.name,
      address: agreementTemplate.address,
      startDate: tenant.startDate || "To be determined",
      endDate: tenant.endDate || "To be determined",
      increasedRentDate: tenant.increasedRentDate || "After initial term",
      initialRent: agreementTemplate.initialRent,
      increasedRent: agreementTemplate.increasedRent,
      utilities: agreementTemplate.utilities,
      dueDate: agreementTemplate.dueDate,
      lateFee: agreementTemplate.lateFee,
      noticePeriod: agreementTemplate.noticePeriod
    };
  };
  
  // Get current agreement details based on selected tenant
  const currentAgreement = getAgreementDetails(selectedTenant || "ozzy");

  const { data: currentRental } = useReadContract({
    address: RENTAL_CONTRACT_ADDRESS,
    abi: RENTAL_ABI,
    functionName: 'getRental',
    args: [0],
    enabled: !!rentalCount && Number(rentalCount) > 0,
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: !!address,
  });

  // Contract writes
  const { writeContract: approveUSDC, data: approvalData } = useWriteContract();
  const { writeContract: payRent, data: paymentData } = useWriteContract();
  const { writeContract: createRental, data: createRentalData } = useWriteContract();

  // Transaction receipts
  const { isLoading: isApprovalLoading } = useWaitForTransactionReceipt({ hash: approvalData });
  const { isLoading: isPaymentLoading } = useWaitForTransactionReceipt({ hash: paymentData });

  // Check if user is landlord
  useEffect(() => {
    if (currentRental && address) {
      setIsLandlord(currentRental[0].toLowerCase() === address.toLowerCase());
    }
  }, [currentRental, address]);

  // Reset form data when tenant selection changes
  useEffect(() => {
    if (selectedTenant) {
      const tenant = tenants.find(t => t.id === selectedTenant);
      if (tenant) {
        setNewRentalData({
          ...newRentalData,
          tenant: tenant.address,
          startDate: tenant.startDate ? new Date(tenant.startDate).toISOString().split('T')[0] : '',
          endDate: tenant.endDate ? new Date(tenant.endDate).toISOString().split('T')[0] : '',
        });
      }
    }
  }, [selectedTenant]);

  const handlePayment = async () => {
    if (!currentRental || !address) return;

    try {
      setPaymentStatus('approving');
      await approveUSDC({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [RENTAL_CONTRACT_ADDRESS, currentRental[3]],
      });

      setPaymentStatus('paying');
      await payRent({
        address: RENTAL_CONTRACT_ADDRESS,
        abi: RENTAL_ABI,
        functionName: 'payRent',
        args: [0],
      });

      setPaymentStatus('success');
    } catch (error) {
      console.error('Payment failed:', error);
      setPaymentStatus('error');
    }
  };

  const handleCreateRental = async (e) => {
    e.preventDefault();
    if (!address) return;

    try {
      const startTimestamp = Math.floor(new Date(newRentalData.startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(newRentalData.endDate).getTime() / 1000);
      // Convert rent to USDC units (6 decimals)
      const rentInBaseUnits = parseUnits(newRentalData.monthlyRent, 6);

      await createRental({
        address: RENTAL_CONTRACT_ADDRESS,
        abi: RENTAL_ABI,
        functionName: 'createRental',
        args: [
          newRentalData.tenant,
          newRentalData.propertyDetails,
          rentInBaseUnits,
          startTimestamp,
          endTimestamp
        ],
      });

      setCreateRentalMode(false);
      // Reset to template values
      setNewRentalData({
        tenant: '',
        propertyDetails: '1316 Harrington Avenue, Fort Worth, TX 76164 - Room Rental',
        monthlyRent: '300',
        startDate: '',
        endDate: '',
        increasedRentDate: '',
        increasedRentAmount: '700',
        utilities: ["Water", "Electricity", "Gas", "Internet"].join(", "),
        lateFee: '25'
      });
      setSelectedTenant('');
    } catch (error) {
      console.error('Failed to create rental:', error);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Rental Payment Portal</h1>
          <WalletDefault />
        </div>
        
        {!isConnected ? (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Rental Payment Portal</CardTitle>
              <CardDescription>
                Please connect your wallet to continue
              </CardDescription>
            </CardHeader>
          </Card>
        ) : isLandlord ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle2 className="h-6 w-6" />
                  Landlord Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!createRentalMode && !viewAgreementMode ? (
                  <div className="space-y-4">
                    <Button 
                      onClick={() => setCreateRentalMode(true)}
                      className="w-full"
                    >
                      Create New Rental Agreement
                    </Button>
                    <Button 
                      onClick={() => setViewAgreementMode(true)}
                      className="w-full"
                      variant="outline"
                    >
                      View Agreement Template
                    </Button>
                  </div>
                ) : viewAgreementMode ? (
                  <div className="space-y-4">
                    <div className="border p-4 rounded-md">
                      <h3 className="text-lg font-semibold mb-2">Rental Agreement Template</h3>
                      <p className="text-sm text-gray-500 mb-4">This template serves as a framework for all rental agreements</p>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Landlord:</p>
                          <p className="text-sm">{agreementTemplate.landlord}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Property:</p>
                          <p className="text-sm">{agreementTemplate.address}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Initial Rent:</p>
                          <p className="text-sm">{agreementTemplate.initialRent}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Increased Rent:</p>
                          <p className="text-sm">{agreementTemplate.increasedRent}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Due Date:</p>
                          <p className="text-sm">{agreementTemplate.dueDate}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Late Fee:</p>
                          <p className="text-sm">{agreementTemplate.lateFee}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Utilities Included:</p>
                          <p className="text-sm">{agreementTemplate.utilities.join(", ")}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <p className="text-sm font-medium">Notice Period:</p>
                          <p className="text-sm">{agreementTemplate.noticePeriod}</p>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => {
                        setViewAgreementMode(false);
                        setCreateRentalMode(true);
                      }}
                      className="w-full"
                    >
                      Create New Agreement
                    </Button>
                    <Button 
                      onClick={() => setViewAgreementMode(false)}
                      variant="outline"
                      className="w-full"
                    >
                      Back
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateRental} className="space-y-4">
                    <div>
                      <Label>Select Tenant</Label>
                      <select 
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm"
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value)}
                      >
                        <option value="">-- Select a tenant --</option>
                        {tenants.map(tenant => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </option>
                        ))}
                        <option value="new">Add New Tenant</option>
                      </select>
                    </div>
                    <div>
                      <Label>Tenant Address</Label>
                      <Input
                        value={newRentalData.tenant}
                        onChange={(e) => setNewRentalData({
                          ...newRentalData,
                          tenant: e.target.value
                        })}
                        placeholder="0x..."
                        required
                      />
                    </div>
                    <div>
                      <Label>Property Details</Label>
                      <Input
                        value={newRentalData.propertyDetails}
                        onChange={(e) => setNewRentalData({
                          ...newRentalData,
                          propertyDetails: e.target.value
                        })}
                        placeholder="Property address and details"
                        required
                      />
                    </div>
                    <div>
                      <Label>Monthly Rent (USDC)</Label>
                      <Input
                        type="number"
                        value={newRentalData.monthlyRent}
                        onChange={(e) => setNewRentalData({
                          ...newRentalData,
                          monthlyRent: e.target.value
                        })}
                        placeholder="300"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={newRentalData.startDate}
                          onChange={(e) => setNewRentalData({
                            ...newRentalData,
                            startDate: e.target.value
                          })}
                          required
                        />
                      </div>
                      <div>
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={newRentalData.endDate}
                          onChange={(e) => setNewRentalData({
                            ...newRentalData,
                            endDate: e.target.value
                          })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Increased Rent Date</Label>
                        <Input
                          type="date"
                          value={newRentalData.increasedRentDate}
                          onChange={(e) => setNewRentalData({
                            ...newRentalData,
                            increasedRentDate: e.target.value
                          })}
                        />
                      </div>
                      <div>
                        <Label>Increased Rent Amount</Label>
                        <Input
                          type="number"
                          value={newRentalData.increasedRentAmount}
                          onChange={(e) => setNewRentalData({
                            ...newRentalData,
                            increasedRentAmount: e.target.value
                          })}
                          placeholder="700"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Utilities Included</Label>
                      <Input
                        value={newRentalData.utilities}
                        onChange={(e) => setNewRentalData({
                          ...newRentalData,
                          utilities: e.target.value
                        })}
                        placeholder="Water, Electricity, Gas, Internet"
                      />
                    </div>
                    <div>
                      <Label>Late Fee Amount</Label>
                      <Input
                        type="number"
                        value={newRentalData.lateFee}
                        onChange={(e) => setNewRentalData({
                          ...newRentalData,
                          lateFee: e.target.value
                        })}
                        placeholder="25"
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit" className="flex-1">
                        Create Rental
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setCreateRentalMode(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
            
            {/* Rental Details Card - Added for landlords to view created rentals */}
            {currentRental && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-6 w-6" />
                    Active Rental
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tenant</Label>
                      <p className="text-sm">{currentRental[1]}</p>
                    </div>
                    <div>
                      <Label>Property</Label>
                      <p className="text-sm">{currentRental[2]}</p>
                    </div>
                    <div>
                      <Label>Monthly Rent</Label>
                      <p className="text-sm">{Number(currentRental[3]) / 1e6} USDC</p>
                    </div>
                    <div>
                      <Label>Next Payment Due</Label>
                      <p className="text-sm">
                        {new Date(Number(currentRental[6]) * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <p className="text-sm">
                        {currentRental[7] ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-6 w-6" />
                Tenant Dashboard
              </CardTitle>
              <CardDescription>
                Manage your rental payments securely on Base
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
                              <Button 
                onClick={() => setViewAgreementMode(!viewAgreementMode)}
                variant="outline"
                className="w-full mb-4"
              >
                {viewAgreementMode ? "Hide Agreement" : "View Rental Agreement"}
              </Button>
              
              {viewAgreementMode && (
                <div className="border p-4 rounded-md mb-4">
                  <h3 className="text-lg font-semibold mb-2">Rental Agreement Details</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Landlord:</p>
                      <p className="text-sm">{currentAgreement.landlord}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Tenant:</p>
                      <p className="text-sm">{currentAgreement.tenant}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Property:</p>
                      <p className="text-sm">{currentAgreement.address}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Term:</p>
                      <p className="text-sm">{currentAgreement.startDate} to {currentAgreement.endDate}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Monthly Rent:</p>
                      <p className="text-sm">{currentAgreement.initialRent}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Increased Rent:</p>
                      <p className="text-sm">{currentAgreement.increasedRent}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Due Date:</p>
                      <p className="text-sm">{currentAgreement.dueDate}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-sm font-medium">Utilities Included:</p>
                      <p className="text-sm">{currentAgreement.utilities.join(", ")}</p>
                    </div>
                  </div>
                </div>
              )
                  </div>
                </div>
              )}
              
              {currentRental && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Property</Label>
                      <p className="text-sm">{currentRental[2]}</p>
                    </div>
                    <div>
                      <Label>Monthly Rent</Label>
                      <p className="text-sm">{Number(currentRental[3]) / 1e6} USDC</p>
                    </div>
                    <div>
                      <Label>Next Payment Due</Label>
                      <p className="text-sm">
                        {new Date(Number(currentRental[6]) * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label>Your USDC Balance</Label>
                      <p className="text-sm">
                        {usdcBalance ? Number(usdcBalance) / 1e6 : 0} USDC
                      </p>
                    </div>
                  </div>

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
                disabled={
                  !isConnected || 
                  isApprovalLoading || 
                  isPaymentLoading || 
                  !currentRental?.[7]
                }
              >
                {(isApprovalLoading || isPaymentLoading) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {!isConnected ? 'Connect Wallet to Pay' : 
                 isApprovalLoading ? 'Approving USDC...' :
                 isPaymentLoading ? 'Processing Payment...' :
                 'Pay Rent'}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}