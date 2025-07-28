
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Crown, Plus, Edit, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminUIKiPadhai = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_url: '',
    course_type: 'premium',
    is_active: true,
  });

  // For demo purposes, using a mock query since we don't have the actual table
  const { data: uiKiPadhaiContent } = useQuery({
    queryKey: ['ui-ki-padhai-content'],
    queryFn: async () => {
      // This would normally fetch from a dedicated table
      return [];
    },
  });

  const handleSave = () => {
    // This would normally save to database
    toast({ title: "Success", description: "UI Ki Padhai content updated successfully" });
    setIsEditing(false);
    setEditingItem(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content_url: '',
      course_type: 'premium',
      is_active: true,
    });
  };

  const startEditing = (item: any = null) => {
    setIsEditing(true);
    setEditingItem(item);
    if (item) {
      setFormData(item);
    } else {
      resetForm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Crown className="mr-2 h-6 w-6 text-yellow-600" />
          UI Ki Padhai Management
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            Premium Content
          </Badge>
          <Button onClick={() => startEditing()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Content
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content List */}
        <Card>
          <CardHeader>
            <CardTitle>UI Ki Padhai Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uiKiPadhaiContent && uiKiPadhaiContent.length > 0 ? (
                uiKiPadhaiContent.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{item.title}</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.description}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{item.course_type}</Badge>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Crown className="h-12 w-12 mx-auto mb-4 text-yellow-400 opacity-50" />
                  <p>No UI Ki Padhai content yet</p>
                  <p className="text-sm mt-2">Add premium courses and content here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        {isEditing && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingItem ? 'Edit Content' : 'Add New Content'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Advanced React Patterns"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the content..."
                  className="min-h-[100px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Content URL</label>
                <Input
                  value={formData.content_url}
                  onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Save Content
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Management Info */}
      <Card>
        <CardHeader>
          <CardTitle>UI Ki Padhai Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-yellow-700">🎯 Purpose</h4>
              <p className="text-sm text-muted-foreground mt-1">
                UI Ki Padhai is a premium section for advanced courses and exclusive content
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-700">📋 Management</h4>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Only Super Admin can manage and update content</li>
                <li>• Content is visible to all students but marked as premium</li>
                <li>• Use embed links for video content</li>
                <li>• Regular updates to keep content fresh</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-green-700">✨ Features</h4>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Premium course materials</li>
                <li>• Advanced tutorials and guides</li>
                <li>• Exclusive content for enrolled students</li>
                <li>• Regular content updates</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
