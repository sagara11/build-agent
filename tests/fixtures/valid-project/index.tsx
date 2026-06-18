import { User } from './types';

function UserCard({ user }: { user: User }) {
  return <div>{user.name}</div>;
}

export default UserCard;
