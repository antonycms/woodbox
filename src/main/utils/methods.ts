import { app } from 'electron';
import { resolve } from 'path';
import fs from 'fs';
import fsPromise from 'fs/promises';

export const generateHash = (len = 5) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < len; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};

export const getLocalDirPath = () => {
  const root_path = app.getPath('userData');
  return resolve(root_path, 'local_app_files');
};

export const writeFile = async (path: string, content: string, options?: IFileOptions) => {
  await fsPromise.writeFile(path, content, options);
  return path;
};

export const readFile = (path: string, options?: IFileOptions) => {
  return fsPromise.readFile(path, options);
};

export const appendFile = (path: string, content: string, options?: IFileOptions) => {
  return fsPromise.appendFile(path, content, options);
};

export const deleteFile = (path: string) => {
  return fsPromise.unlink(path);
};

interface IFileOptions {
  encoding: BufferEncoding;
  flag?: fs.OpenMode;
}
