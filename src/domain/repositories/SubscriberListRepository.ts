import { SubscriberList } from '../entities/SubscriberList';

export interface ListMembershipInfo {
  subscriberId: string;
  phoneNumber: string;
  joinedAt: Date;
  joinedVia: string | null;
}

export interface SubscriberListRepository {
  add(list: SubscriberList): Promise<SubscriberList>;
  findById(id: string): Promise<SubscriberList | null>;
  findByName(name: string): Promise<SubscriberList | null>;
  findAll(): Promise<SubscriberList[]>;
  update(list: SubscriberList): Promise<SubscriberList>;
  delete(id: string): Promise<void>;

  // Membership operations
  addMember(listId: string, subscriberId: string, joinedVia?: string): Promise<void>;
  removeMember(listId: string, subscriberId: string): Promise<void>;
  getMembers(listId: string): Promise<ListMembershipInfo[]>;
  getMemberCount(listId: string): Promise<number>;
  getListsForSubscriber(subscriberId: string): Promise<SubscriberList[]>;
}
