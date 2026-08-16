import fs from 'fs';

export const getSslConfig = ({
  ssl,
  sslRejectUnauthorized,
  sslCaCert,
  sslCert,
  sslKey,
}: IConnectionConfig) => {
  if (!ssl) return undefined;

  return {
    rejectUnauthorized: !!sslRejectUnauthorized,
    ...(sslCaCert ? { ca: fs.readFileSync(sslCaCert, 'utf8') } : {}),
    ...(sslCert ? { cert: fs.readFileSync(sslCert, 'utf8') } : {}),
    ...(sslKey ? { key: fs.readFileSync(sslKey, 'utf8') } : {}),
  };
};
