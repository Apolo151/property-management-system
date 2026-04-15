import { useEffect } from 'react';
import ConfirmationDialog from './ConfirmationDialog';
import useConfirmationStore from '../store/confirmationStore';

export default {
  title: 'Components/ConfirmationDialog',
  component: ConfirmationDialog,
};

function OpenDanger() {
  useEffect(() => {
    useConfirmationStore.setState({
      isOpen: true,
      title: 'Delete item?',
      message: 'This cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      resolve: null,
    });
    return () => {
      useConfirmationStore.getState().cancel();
    };
  }, []);
  return <ConfirmationDialog />;
}

export const DangerOpen = {
  render: () => <OpenDanger />,
};
