import Modal from './Modal';

export default {
  title: 'Components/Modal',
  component: Modal,
};

export const Default = {
  args: {
    isOpen: true,
    title: 'Example modal',
    children: <p className="text-gray-700 dark:text-gray-300">Modal body content.</p>,
    onClose: () => {},
  },
};
