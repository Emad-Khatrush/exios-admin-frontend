import React from 'react';
import UserWidget from './UserWidget/UserWidget';

const ListView = ({ clients }: { clients: any[] }) => {
  return (
    <div>
      {clients.map((client, i) => (
        <UserWidget key={client._id || i} client={client} index={i + 1} />
      ))}
    </div>
  );
};

export default ListView;