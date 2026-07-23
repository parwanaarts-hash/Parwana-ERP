import { RefreshCcw, Save, Edit, Trash2, LogOut } from "lucide-react";
import { useLocation } from "wouter";

interface ToolbarProps {
  onRefresh?: () => void;
  onSave?: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
  onExit?: () => void;
  canSave?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export function Toolbar({
  onRefresh,
  onSave,
  onUpdate,
  onDelete,
  onExit,
  canSave = false,
  canUpdate = false,
  canDelete = false,
  isSaving = false,
  isDeleting = false
}: ToolbarProps) {
  const [, setLocation] = useLocation();

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      setLocation("/");
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-card border rounded-md shadow-sm shrink-0" data-testid="container-toolbar">
      <button 
        className={`flex flex-col items-center justify-center rounded-md transition-colors h-auto py-2 px-4 gap-1 text-xs ${!onRefresh ? 'opacity-50 pointer-events-none' : 'hover:bg-muted'}`}
        onClick={onRefresh}
        disabled={!onRefresh}
        data-testid="button-toolbar-refresh"
      >
        <RefreshCcw className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-foreground">Refresh</span>
      </button>
      <div className="w-px h-10 bg-border mx-1" />
      <button 
        className={`flex flex-col items-center justify-center rounded-md transition-colors h-auto py-2 px-4 gap-1 text-xs ${(!onSave || !canSave || isSaving) ? 'opacity-50 pointer-events-none' : 'hover:bg-muted'}`}
        onClick={onSave}
        disabled={!onSave || !canSave || isSaving}
        data-testid="button-toolbar-save"
      >
        <Save className="h-5 w-5 text-green-600" />
        <span className="font-medium text-foreground">{isSaving ? 'Saving...' : 'Save'}</span>
      </button>
      <button 
        className={`flex flex-col items-center justify-center rounded-md transition-colors h-auto py-2 px-4 gap-1 text-xs ${(!onUpdate || !canUpdate || isSaving) ? 'opacity-50 pointer-events-none' : 'hover:bg-muted'}`}
        onClick={onUpdate}
        disabled={!onUpdate || !canUpdate || isSaving}
        data-testid="button-toolbar-update"
      >
        <Edit className="h-5 w-5 text-amber-600" />
        <span className="font-medium text-foreground">{isSaving ? 'Updating...' : 'Update'}</span>
      </button>
      <button 
        className={`flex flex-col items-center justify-center rounded-md transition-colors h-auto py-2 px-4 gap-1 text-xs ${(!onDelete || !canDelete || isDeleting) ? 'opacity-50 pointer-events-none' : 'hover:bg-muted hover:text-destructive'}`}
        onClick={onDelete}
        disabled={!onDelete || !canDelete || isDeleting}
        data-testid="button-toolbar-delete"
      >
        <Trash2 className="h-5 w-5 text-red-500" />
        <span className="font-medium">{isDeleting ? 'Deleting...' : 'Delete'}</span>
      </button>
      <div className="w-px h-10 bg-border mx-1" />
      <button 
        className="flex flex-col items-center justify-center rounded-md hover:bg-muted transition-colors h-auto py-2 px-4 gap-1 text-xs" 
        onClick={handleExit} 
        data-testid="button-toolbar-exit"
      >
        <LogOut className="h-5 w-5 text-slate-600" />
        <span className="font-medium text-foreground">Exit</span>
      </button>
    </div>
  );
}