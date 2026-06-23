import { fetchPostLikers } from '../api/postsApi';
import { UserListSheet } from './UserListSheet';

type PostLikersModalProps = {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onUserPress?: (userId: string) => void;
};

export function PostLikersModal({ visible, postId, onClose, onUserPress }: PostLikersModalProps) {
  return (
    <UserListSheet
      visible={visible}
      title="Likes"
      reloadKey={postId}
      load={async () => {
        const response = await fetchPostLikers(postId);
        return response.users;
      }}
      onClose={onClose}
      onUserPress={onUserPress}
      emptyText="No likes yet."
    />
  );
}
