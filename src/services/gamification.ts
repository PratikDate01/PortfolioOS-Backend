import { UserModel } from '../models/user.model';
import { BadgeModel } from '../models/badge.model';
import { UserProgressModel } from '../models/userProgress.model';
import { BookmarkModel } from '../models/bookmark.model';

// Seed default badges in-memory/DB helper if missing
async function ensureBadgesExist() {
  const defaults = [
    {
      key: 'first_steps',
      title: 'First Steps',
      description: 'You took your first active step on the Portfolio OS!',
      iconUrl: '👣',
      xpReward: 0,
      criteria: 'Any progress event'
    },
    {
      key: 'chatterbox',
      title: 'Chatterbox',
      description: 'Awarded for posting a blog comment.',
      iconUrl: '💬',
      xpReward: 0,
      criteria: 'Post a comment'
    },
    {
      key: 'networker',
      title: 'Networker',
      description: 'Awarded for reaching out via the contact form.',
      iconUrl: '🤝',
      xpReward: 0,
      criteria: 'Submit contact message'
    },
    {
      key: 'collector',
      title: 'Collector',
      description: 'Awarded for bookmarking 3 or more projects/blogs.',
      iconUrl: '📚',
      xpReward: 0,
      criteria: 'Bookmark 3 items'
    }
  ];

  for (const b of defaults) {
    const exists = await BadgeModel.findOne({ key: b.key });
    if (!exists) {
      await BadgeModel.create(b);
    }
  }
}

export async function awardXp(
  userId: string,
  type: 'page_visit' | 'project_view' | 'badge_earned' | 'comment_posted' | 'message_sent',
  xpAmount: number,
  metadata?: Record<string, any>
): Promise<{ xpAwarded: number; levelUp: boolean; unlockedBadges: string[] }> {
  try {

    // 1. Fetch user
    const user = await UserModel.findById(userId);
    if (!user) return { xpAwarded: 0, levelUp: false, unlockedBadges: [] };

    // 2. Create progress ledger event
    const progressEvent = new UserProgressModel({
      userId,
      type,
      xpAwarded: 0,
      metadata
    });
    await progressEvent.save();

    // 3. Update user XP & Level (Bypassed / Removed)
    const levelUp = false;

    // 4. Ensure badges exist in DB
    await ensureBadgesExist();

    // 5. Check for newly unlocked badges
    const unlockedBadges: string[] = [];
    const allBadges = await BadgeModel.find({});
    
    for (const badge of allBadges) {
      // Check if user already has it
      if (user.badgeIds.map(id => id.toString()).includes(badge._id.toString())) {
        continue;
      }

      let meetsCriteria = false;

      if (badge.key === 'first_steps') {
        meetsCriteria = true;
      } else if (badge.key === 'chatterbox' && type === 'comment_posted') {
        meetsCriteria = true;
      } else if (badge.key === 'networker' && type === 'message_sent') {
        meetsCriteria = true;
      } else if (badge.key === 'collector') {
        // Count bookmarks
        const bookmarkCount = await BookmarkModel.countDocuments({ userId });
        if (bookmarkCount >= 3) {
          meetsCriteria = true;
        }
      }

      if (meetsCriteria) {
        // Award badge to user
        user.badgeIds.push(badge._id as any);
        await user.save();
        
        // Award badge (recursively logs badge_earned event)
        await awardXp(userId, 'badge_earned', 0, { badgeKey: badge.key });
        unlockedBadges.push(badge.title);
      }
    }

    return { xpAwarded: 0, levelUp, unlockedBadges };
  } catch (error) {
    console.error('Error awarding XP:', error);
    return { xpAwarded: 0, levelUp: false, unlockedBadges: [] };
  }
}
