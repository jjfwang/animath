/** Node-only durable local adapter. Distributed production uses cloud object storage + DB CAS. */
import type { ObjectStore } from './approved-assets';
export function createFileStore(root:string):ObjectStore;
