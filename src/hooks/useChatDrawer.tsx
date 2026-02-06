import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SubjectContext {
  batch: string;
  subject: string;
}

interface Recipient {
  id: string;
  name: string;
  displayName: string;
}

interface ChatDrawerState {
  isOpen: boolean;
  mode: 'support' | 'subject-connect';
  subjectContext?: SubjectContext;
  selectedRecipient?: Recipient;
  supportRole?: 'admin' | 'manager';
}

interface ChatDrawerContextValue {
  state: ChatDrawerState;
  openSupportDrawer: () => void;
  openSubjectConnect: (batch: string, subject: string) => void;
  closeDrawer: () => void;
  selectSupportRole: (role: 'admin' | 'manager') => void;
  setRecipient: (recipient: Recipient) => void;
  resetToRoleSelection: () => void;
}

const defaultState: ChatDrawerState = {
  isOpen: false,
  mode: 'support',
  subjectContext: undefined,
  selectedRecipient: undefined,
  supportRole: undefined,
};

const ChatDrawerContext = createContext<ChatDrawerContextValue | undefined>(undefined);

export const ChatDrawerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ChatDrawerState>(defaultState);

  const openSupportDrawer = useCallback(() => {
    setState({
      isOpen: true,
      mode: 'support',
      subjectContext: undefined,
      selectedRecipient: undefined,
      supportRole: undefined,
    });
  }, []);

  const openSubjectConnect = useCallback((batch: string, subject: string) => {
    setState({
      isOpen: true,
      mode: 'subject-connect',
      subjectContext: { batch, subject },
      selectedRecipient: undefined,
      supportRole: undefined,
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setState(defaultState);
  }, []);

  const selectSupportRole = useCallback((role: 'admin' | 'manager') => {
    setState(prev => ({
      ...prev,
      supportRole: role,
    }));
  }, []);

  const setRecipient = useCallback((recipient: Recipient) => {
    setState(prev => ({
      ...prev,
      selectedRecipient: recipient,
    }));
  }, []);

  const resetToRoleSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedRecipient: undefined,
      supportRole: undefined,
    }));
  }, []);

  return (
    <ChatDrawerContext.Provider
      value={{
        state,
        openSupportDrawer,
        openSubjectConnect,
        closeDrawer,
        selectSupportRole,
        setRecipient,
        resetToRoleSelection,
      }}
    >
      {children}
    </ChatDrawerContext.Provider>
  );
};

export const useChatDrawer = () => {
  const context = useContext(ChatDrawerContext);
  if (!context) {
    throw new Error('useChatDrawer must be used within a ChatDrawerProvider');
  }
  return context;
};
