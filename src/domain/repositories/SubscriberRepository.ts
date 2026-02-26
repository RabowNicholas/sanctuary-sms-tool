import { Subscriber } from '../entities/Subscriber';

export interface SubscriberRepository {
  add(subscriber: Subscriber): Promise<Subscriber>;
  findByPhoneNumber(phoneNumber: string): Promise<Subscriber | null>;
  findById(id: string): Promise<Subscriber | null>;
  update(subscriber: Subscriber): Promise<Subscriber>;
  findAllActive(): Promise<Subscriber[]>;
  findActiveByListIds(listIds: string[]): Promise<Subscriber[]>;
  findAllActiveExcluding(excludeListIds: string[]): Promise<Subscriber[]>;
  findActiveByListIdsExcluding(includeListIds: string[], excludeListIds: string[]): Promise<Subscriber[]>;
  count(): Promise<number>;
}