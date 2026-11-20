import { ProcessInboundMessage } from '@/domain/usecases/ProcessInboundMessage';
import { Subscriber } from '@/domain/entities/Subscriber';
import { SignupKeyword } from '@/domain/entities/SignupKeyword';

const PHONE = '+15551234567';

function setup(opts: { keyword?: SignupKeyword | null; existing?: Subscriber | null } = {}) {
  const subscriberRepo: any = {
    findByPhoneNumber: jest.fn().mockResolvedValue(opts.existing ?? null),
    add: jest.fn(async (s) => s),
    update: jest.fn(async (s) => s),
  };
  const keywordRepo: any = {
    findByKeyword: jest.fn().mockResolvedValue(
      opts.keyword === undefined
        ? SignupKeyword.fromPersistence('k1', 'FLOW', 'Welcome to FLOW', true, 'list1', new Date())
        : opts.keyword,
    ),
    findAllActive: jest.fn().mockResolvedValue([]),
  };
  const listRepo: any = { addMember: jest.fn() };
  const uc = new ProcessInboundMessage(subscriberRepo, keywordRepo, listRepo, { sendMessage: jest.fn() }, { postMessage: jest.fn() });
  return { uc, subscriberRepo, keywordRepo, listRepo };
}

describe('ProcessInboundMessage.optInViaKeyword', () => {
  it('creates a new subscriber, adds to list tagged web, and notifies Slack', async () => {
    const { uc, subscriberRepo, listRepo } = setup();
    const result = await uc.optInViaKeyword(PHONE, 'flow', 'web');

    expect(subscriberRepo.add).toHaveBeenCalledTimes(1);
    expect(listRepo.addMember).toHaveBeenCalledWith('list1', expect.any(String), 'web:FLOW');
    expect(result).toMatchObject({ shouldRespond: true, response: 'Welcome to FLOW', notifySlack: true, isOptIn: true });
    expect(result!.alreadySubscribed).toBeUndefined();
    expect(result!.slackMessage).toContain('FLOW (web)');
  });

  it('reactivates a previously opted-out subscriber', async () => {
    const existing = Subscriber.fromPersistence('s1', PHONE, false, new Date());
    const { uc, subscriberRepo } = setup({ existing });
    const result = await uc.optInViaKeyword(PHONE, 'FLOW');

    expect(existing.isActive).toBe(true);
    expect(subscriberRepo.update).toHaveBeenCalledWith(existing);
    expect(result!.slackMessage).toContain('reactivated');
  });

  it('flags already-subscribed numbers and still adds them to the list', async () => {
    const existing = Subscriber.fromPersistence('s1', PHONE, true, new Date());
    const { uc, listRepo } = setup({ existing });
    const result = await uc.optInViaKeyword(PHONE, 'FLOW');

    expect(result!.alreadySubscribed).toBe(true);
    expect(result!.notifySlack).toBe(false);
    expect(listRepo.addMember).toHaveBeenCalledWith('list1', 's1', 'web:FLOW');
  });

  it('returns null for an inactive keyword', async () => {
    const inactive = SignupKeyword.fromPersistence('k1', 'FLOW', 'x', false, null, new Date());
    const { uc, subscriberRepo } = setup({ keyword: inactive });
    expect(await uc.optInViaKeyword(PHONE, 'FLOW')).toBeNull();
    expect(subscriberRepo.add).not.toHaveBeenCalled();
  });

  it('returns null for an unknown keyword', async () => {
    const { uc } = setup({ keyword: null });
    expect(await uc.optInViaKeyword(PHONE, 'NOPE')).toBeNull();
  });

  it('keeps the SMS path tagged as keyword', async () => {
    const { uc, listRepo } = setup();
    await uc.execute(PHONE, 'flow');
    expect(listRepo.addMember).toHaveBeenCalledWith('list1', expect.any(String), 'keyword:FLOW');
  });
});
