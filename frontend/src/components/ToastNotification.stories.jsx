import ToastNotification from './ToastNotification';

export default {
  title: 'Components/ToastNotification',
  component: ToastNotification,
};

export const Success = {
  args: {
    toast: { id: '1', type: 'success', message: 'Saved successfully', duration: 0 },
    onDismiss: () => {},
  },
};

export const Error = {
  args: {
    toast: { id: '2', type: 'error', message: 'Something went wrong', duration: 0 },
    onDismiss: () => {},
  },
};
