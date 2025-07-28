import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Settings, Code, Eye } from 'lucide-react';

export const AdminCustomSections = () => {
  const [sectionName, setSectionName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [sectionContent, setSectionContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);

  const handleCreateSection = () => {
    // This would normally save to database
    console.log('Creating section:', { sectionName, targetRole, sectionContent });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Plus className="mr-2 h-6 w-6" />
          Custom Section Creator
        </h2>
        <p className="text-sm text-muted-foreground">
          Create new tabs/sections for students and teachers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Builder */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Section Name</label>
              <Input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="e.g., Extra Resources, Announcements"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Target Role</label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="both">Both Students & Teachers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Section Content</label>
              <Textarea
                value={sectionContent}
                onChange={(e) => setSectionContent(e.target.value)}
                placeholder="Enter HTML content or description..."
                className="min-h-[200px]"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleCreateSection} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                Create Section
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsPreview(!isPreview)}
              >
                <Eye className="mr-2 h-4 w-4" />
                {isPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {isPreview ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">{sectionName || 'Section Name'}</h3>
                  <div className="text-sm text-muted-foreground">
                    Target: {targetRole || 'Not selected'}
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded">
                    {sectionContent || 'Section content will appear here...'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Preview" to see how your section will look</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Existing Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Custom Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No custom sections created yet</p>
            <p className="text-sm mt-2">Created sections will appear here for management</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
