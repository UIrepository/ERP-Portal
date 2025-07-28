
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Save, CreditCard } from 'lucide-react';

export const TeacherBankDetails = () => {
  const { profile } = useAuth();
  const [bankDetails, setBankDetails] = useState({
    account_number: profile?.bank_details?.account_number || '',
    ifsc_code: profile?.bank_details?.ifsc_code || '',
    account_holder_name: profile?.bank_details?.account_holder_name || '',
    bank_name: profile?.bank_details?.bank_name || '',
    branch_name: profile?.bank_details?.branch_name || ''
  });

  const queryClient = useQueryClient();

  const updateBankDetailsMutation = useMutation({
    mutationFn: async (details: any) => {
      const { error } = await supabase
        .from('profiles')
        .update({ bank_details: details })
        .eq('id', profile?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: 'Success',
        description: 'Bank details updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!bankDetails.account_number || !bankDetails.ifsc_code || !bankDetails.account_holder_name) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    updateBankDetailsMutation.mutate(bankDetails);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bank Details</h2>
        <CreditCard className="h-6 w-6 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Bank Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account_holder_name">Account Holder Name *</Label>
              <Input
                id="account_holder_name"
                value={bankDetails.account_holder_name}
                onChange={(e) => setBankDetails({ ...bankDetails, account_holder_name: e.target.value })}
                placeholder="Enter account holder name"
              />
            </div>
            <div>
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                value={bankDetails.account_number}
                onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                placeholder="Enter account number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ifsc_code">IFSC Code *</Label>
              <Input
                id="ifsc_code"
                value={bankDetails.ifsc_code}
                onChange={(e) => setBankDetails({ ...bankDetails, ifsc_code: e.target.value.toUpperCase() })}
                placeholder="Enter IFSC code"
              />
            </div>
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={bankDetails.bank_name}
                onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                placeholder="Enter bank name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="branch_name">Branch Name</Label>
            <Input
              id="branch_name"
              value={bankDetails.branch_name}
              onChange={(e) => setBankDetails({ ...bankDetails, branch_name: e.target.value })}
              placeholder="Enter branch name"
            />
          </div>

          <Button onClick={handleSave} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Bank Details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
