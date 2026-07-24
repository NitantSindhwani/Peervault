declare module 'piexifjs' {
  const piexif: {
    remove: (dataUrl: string) => string;
    load: (dataUrl: string) => any;
    dump: (exifObj: any) => string;
    insert: (exifBytes: string, dataUrl: string) => string;
  };
  export default piexif;
}
