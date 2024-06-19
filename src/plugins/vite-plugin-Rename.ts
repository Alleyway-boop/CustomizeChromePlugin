import { Plugin } from 'vite';

export function RenameUnderscoreFiles(): Plugin {
    return {
        name: 'rename-underscore-files',
        generateBundle(options, bundle) {
            for (const [fileName, file] of Object.entries(bundle)) {
                if (fileName.startsWith('_')) {
                    const newFileName = fileName.replace(/^_/, '');
                    bundle[newFileName] = file;
                    delete bundle[fileName];
                }
            }
        }
    };
}
