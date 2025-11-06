import { Subscriber } from '../entities/Subscriber';

export interface SubscriberRepository {
  add(subscriber: Subscriber): Promise<Subscriber>;
  findByPhoneNumber(phoneNumber: string): Promise<Subscriber | null>;
  update(subscriber: Subscriber): Promise<Subscriber>;
  findAllActive(): Promise<Subscriber[]>;
  count(): Promise<number>;
}