const ATLAS_SRV_HOST = 'book-uz.smnoitk.mongodb.net';

const ATLAS_DIRECT_HOSTS = [
  'ac-zdrgs6e-shard-00-00.smnoitk.mongodb.net:27017',
  'ac-zdrgs6e-shard-00-01.smnoitk.mongodb.net:27017',
  'ac-zdrgs6e-shard-00-02.smnoitk.mongodb.net:27017',
];

const ATLAS_REPLICA_SET = 'atlas-q2p47m-shard-0';

/**
 * This network blocks Node.js SRV DNS lookups. Convert this Atlas cluster's
 * mongodb+srv URI to the equivalent standard replica-set URI while preserving
 * credentials, database name, and existing query options.
 */
export function getMongoConnectionUri(configuredUri: string): string {
  if (!configuredUri.startsWith('mongodb+srv://')) {
    return configuredUri;
  }

  const parsedUri = new URL(configuredUri);

  if (parsedUri.hostname !== ATLAS_SRV_HOST) {
    return configuredUri;
  }

  const credentials = parsedUri.password
    ? `${parsedUri.username}:${parsedUri.password}`
    : parsedUri.username;

  const query = new URLSearchParams(parsedUri.search);
  query.set('tls', 'true');
  query.set('replicaSet', ATLAS_REPLICA_SET);
  query.set('authSource', 'admin');

  return `mongodb://${credentials}@${ATLAS_DIRECT_HOSTS.join(',')}${parsedUri.pathname}?${query.toString()}`;
}
