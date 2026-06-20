export namespace discord {
	
	export class Attachment {
	    id: string;
	    filename: string;
	    url: string;
	    content_type: string;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new Attachment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.filename = source["filename"];
	        this.url = source["url"];
	        this.content_type = source["content_type"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class User {
	    id: string;
	    username: string;
	    global_name: string;
	    discriminator: string;
	    avatar: string;
	    bot: boolean;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.global_name = source["global_name"];
	        this.discriminator = source["discriminator"];
	        this.avatar = source["avatar"];
	        this.bot = source["bot"];
	    }
	}
	export class Channel {
	    id: string;
	    guild_id: string;
	    name: string;
	    type: number;
	    topic: string;
	    position: number;
	    parent_id: string;
	    recipients: User[];
	    last_message_id: string;
	    icon: string;
	
	    static createFrom(source: any = {}) {
	        return new Channel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.guild_id = source["guild_id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.topic = source["topic"];
	        this.position = source["position"];
	        this.parent_id = source["parent_id"];
	        this.recipients = this.convertValues(source["recipients"], User);
	        this.last_message_id = source["last_message_id"];
	        this.icon = source["icon"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Emoji {
	    id: string;
	    name: string;
	    animated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Emoji(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.animated = source["animated"];
	    }
	}
	export class Component {
	    type: number;
	    components: Component[];
	    style: number;
	    label: string;
	    custom_id: string;
	    url: string;
	    disabled: boolean;
	    emoji?: Emoji;
	    placeholder: string;
	
	    static createFrom(source: any = {}) {
	        return new Component(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.components = this.convertValues(source["components"], Component);
	        this.style = source["style"];
	        this.label = source["label"];
	        this.custom_id = source["custom_id"];
	        this.url = source["url"];
	        this.disabled = source["disabled"];
	        this.emoji = this.convertValues(source["emoji"], Emoji);
	        this.placeholder = source["placeholder"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EmbedField {
	    name: string;
	    value: string;
	    inline: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EmbedField(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.inline = source["inline"];
	    }
	}
	export class EmbedProvider {
	    name: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new EmbedProvider(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	    }
	}
	export class EmbedFooter {
	    text: string;
	    icon_url: string;
	
	    static createFrom(source: any = {}) {
	        return new EmbedFooter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.icon_url = source["icon_url"];
	    }
	}
	export class EmbedAuthor {
	    name: string;
	    url: string;
	    icon_url: string;
	
	    static createFrom(source: any = {}) {
	        return new EmbedAuthor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	        this.icon_url = source["icon_url"];
	    }
	}
	export class EmbedMedia {
	    url: string;
	    proxy_url: string;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new EmbedMedia(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.proxy_url = source["proxy_url"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class Embed {
	    type: string;
	    url: string;
	    title: string;
	    description: string;
	    color: number;
	    timestamp: string;
	    thumbnail?: EmbedMedia;
	    image?: EmbedMedia;
	    video?: EmbedMedia;
	    author?: EmbedAuthor;
	    footer?: EmbedFooter;
	    provider?: EmbedProvider;
	    fields: EmbedField[];
	
	    static createFrom(source: any = {}) {
	        return new Embed(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.url = source["url"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.color = source["color"];
	        this.timestamp = source["timestamp"];
	        this.thumbnail = this.convertValues(source["thumbnail"], EmbedMedia);
	        this.image = this.convertValues(source["image"], EmbedMedia);
	        this.video = this.convertValues(source["video"], EmbedMedia);
	        this.author = this.convertValues(source["author"], EmbedAuthor);
	        this.footer = this.convertValues(source["footer"], EmbedFooter);
	        this.provider = this.convertValues(source["provider"], EmbedProvider);
	        this.fields = this.convertValues(source["fields"], EmbedField);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	
	export class Guild {
	    id: string;
	    name: string;
	    icon: string;
	    channels: Channel[];
	
	    static createFrom(source: any = {}) {
	        return new Guild(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.channels = this.convertValues(source["channels"], Channel);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GuildFolder {
	    guild_ids: string[];
	    id: any;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new GuildFolder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.guild_ids = source["guild_ids"];
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	export class PresenceEntry {
	    user_id: string;
	    user?: User;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new PresenceEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user_id = source["user_id"];
	        this.user = this.convertValues(source["user"], User);
	        this.status = source["status"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MergedPresences {
	    friends: PresenceEntry[];
	
	    static createFrom(source: any = {}) {
	        return new MergedPresences(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.friends = this.convertValues(source["friends"], PresenceEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PollAnswerCount {
	    id: number;
	    count: number;
	    me_voted: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PollAnswerCount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.count = source["count"];
	        this.me_voted = source["me_voted"];
	    }
	}
	export class PollResults {
	    is_finalized: boolean;
	    answer_counts: PollAnswerCount[];
	
	    static createFrom(source: any = {}) {
	        return new PollResults(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.is_finalized = source["is_finalized"];
	        this.answer_counts = this.convertValues(source["answer_counts"], PollAnswerCount);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PollMedia {
	    text: string;
	    emoji?: Emoji;
	
	    static createFrom(source: any = {}) {
	        return new PollMedia(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.emoji = this.convertValues(source["emoji"], Emoji);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PollAnswer {
	    answer_id: number;
	    poll_media: PollMedia;
	
	    static createFrom(source: any = {}) {
	        return new PollAnswer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.answer_id = source["answer_id"];
	        this.poll_media = this.convertValues(source["poll_media"], PollMedia);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PollQuestion {
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new PollQuestion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	    }
	}
	export class Poll {
	    question: PollQuestion;
	    answers: PollAnswer[];
	    expiry: string;
	    results?: PollResults;
	    allow_multiselect: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Poll(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.question = this.convertValues(source["question"], PollQuestion);
	        this.answers = this.convertValues(source["answers"], PollAnswer);
	        this.expiry = source["expiry"];
	        this.results = this.convertValues(source["results"], PollResults);
	        this.allow_multiselect = source["allow_multiselect"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MessageReference {
	    message_id: string;
	    channel_id: string;
	    guild_id: string;
	
	    static createFrom(source: any = {}) {
	        return new MessageReference(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.message_id = source["message_id"];
	        this.channel_id = source["channel_id"];
	        this.guild_id = source["guild_id"];
	    }
	}
	export class Reaction {
	    count: number;
	    me: boolean;
	    emoji: Emoji;
	
	    static createFrom(source: any = {}) {
	        return new Reaction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.count = source["count"];
	        this.me = source["me"];
	        this.emoji = this.convertValues(source["emoji"], Emoji);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Message {
	    id: string;
	    channel_id: string;
	    guild_id: string;
	    author: User;
	    content: string;
	    timestamp: string;
	    edited_timestamp: string;
	    attachments: Attachment[];
	    embeds: Embed[];
	    reactions: Reaction[];
	    mentions: User[];
	    mention_roles: string[];
	    nonce: string;
	    type: number;
	    message_reference?: MessageReference;
	    referenced_message?: Message;
	    components: Component[];
	    poll?: Poll;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.channel_id = source["channel_id"];
	        this.guild_id = source["guild_id"];
	        this.author = this.convertValues(source["author"], User);
	        this.content = source["content"];
	        this.timestamp = source["timestamp"];
	        this.edited_timestamp = source["edited_timestamp"];
	        this.attachments = this.convertValues(source["attachments"], Attachment);
	        this.embeds = this.convertValues(source["embeds"], Embed);
	        this.reactions = this.convertValues(source["reactions"], Reaction);
	        this.mentions = this.convertValues(source["mentions"], User);
	        this.mention_roles = source["mention_roles"];
	        this.nonce = source["nonce"];
	        this.type = source["type"];
	        this.message_reference = this.convertValues(source["message_reference"], MessageReference);
	        this.referenced_message = this.convertValues(source["referenced_message"], Message);
	        this.components = this.convertValues(source["components"], Component);
	        this.poll = this.convertValues(source["poll"], Poll);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	
	
	
	
	export class UserSettings {
	    guild_positions: string[];
	    guild_folders: GuildFolder[];
	
	    static createFrom(source: any = {}) {
	        return new UserSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.guild_positions = source["guild_positions"];
	        this.guild_folders = this.convertValues(source["guild_folders"], GuildFolder);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Ready {
	    user: User;
	    session_id: string;
	    resume_gateway_url: string;
	    guilds: Guild[];
	    private_channels: Channel[];
	    user_settings?: UserSettings;
	    merged_presences?: MergedPresences;
	
	    static createFrom(source: any = {}) {
	        return new Ready(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user = this.convertValues(source["user"], User);
	        this.session_id = source["session_id"];
	        this.resume_gateway_url = source["resume_gateway_url"];
	        this.guilds = this.convertValues(source["guilds"], Guild);
	        this.private_channels = this.convertValues(source["private_channels"], Channel);
	        this.user_settings = this.convertValues(source["user_settings"], UserSettings);
	        this.merged_presences = this.convertValues(source["merged_presences"], MergedPresences);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace main {
	
	export class AccountDTO {
	    id: string;
	    username: string;
	    globalName: string;
	    avatarUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new AccountDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.globalName = source["globalName"];
	        this.avatarUrl = source["avatarUrl"];
	    }
	}
	export class AttachmentDTO {
	    id: string;
	    type: string;
	    url: string;
	    width: number;
	    height: number;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new AttachmentDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.url = source["url"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.name = source["name"];
	    }
	}
	export class ButtonDTO {
	    label: string;
	    style: number;
	    url: string;
	    disabled: boolean;
	    emojiUrl: string;
	    emoji: string;
	
	    static createFrom(source: any = {}) {
	        return new ButtonDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.style = source["style"];
	        this.url = source["url"];
	        this.disabled = source["disabled"];
	        this.emojiUrl = source["emojiUrl"];
	        this.emoji = source["emoji"];
	    }
	}
	export class UserDTO {
	    id: string;
	    username: string;
	    displayName: string;
	    avatarUrl: string;
	    bot: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UserDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.displayName = source["displayName"];
	        this.avatarUrl = source["avatarUrl"];
	        this.bot = source["bot"];
	    }
	}
	export class ChannelDTO {
	    id: string;
	    serverId: string;
	    name: string;
	    type: string;
	    topic: string;
	    parentId: string;
	    position: number;
	    isDM: boolean;
	    avatarUrl: string;
	    subtitle: string;
	    recipients: UserDTO[];
	
	    static createFrom(source: any = {}) {
	        return new ChannelDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.serverId = source["serverId"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.topic = source["topic"];
	        this.parentId = source["parentId"];
	        this.position = source["position"];
	        this.isDM = source["isDM"];
	        this.avatarUrl = source["avatarUrl"];
	        this.subtitle = source["subtitle"];
	        this.recipients = this.convertValues(source["recipients"], UserDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EmbedFieldDTO {
	    name: string;
	    value: string;
	    inline: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EmbedFieldDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.inline = source["inline"];
	    }
	}
	export class EmbedDTO {
	    type: string;
	    url: string;
	    title: string;
	    description: string;
	    color: string;
	    authorName: string;
	    authorIcon: string;
	    authorUrl: string;
	    footerText: string;
	    footerIcon: string;
	    providerName: string;
	    imageUrl: string;
	    thumbUrl: string;
	    videoUrl: string;
	    fields: EmbedFieldDTO[];
	
	    static createFrom(source: any = {}) {
	        return new EmbedDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.url = source["url"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.color = source["color"];
	        this.authorName = source["authorName"];
	        this.authorIcon = source["authorIcon"];
	        this.authorUrl = source["authorUrl"];
	        this.footerText = source["footerText"];
	        this.footerIcon = source["footerIcon"];
	        this.providerName = source["providerName"];
	        this.imageUrl = source["imageUrl"];
	        this.thumbUrl = source["thumbUrl"];
	        this.videoUrl = source["videoUrl"];
	        this.fields = this.convertValues(source["fields"], EmbedFieldDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class FriendDTO {
	    id: string;
	    type: number;
	    user: UserDTO;
	
	    static createFrom(source: any = {}) {
	        return new FriendDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.user = this.convertValues(source["user"], UserDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GifDTO {
	    id: string;
	    url: string;
	    previewUrl: string;
	    width: number;
	    height: number;
	
	    static createFrom(source: any = {}) {
	        return new GifDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.url = source["url"];
	        this.previewUrl = source["previewUrl"];
	        this.width = source["width"];
	        this.height = source["height"];
	    }
	}
	export class GuildDTO {
	    id: string;
	    name: string;
	    iconUrl: string;
	    acronym: string;
	
	    static createFrom(source: any = {}) {
	        return new GuildDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.iconUrl = source["iconUrl"];
	        this.acronym = source["acronym"];
	    }
	}
	export class LoginResult {
	    ok: boolean;
	    error: string;
	    user: UserDTO;
	
	    static createFrom(source: any = {}) {
	        return new LoginResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.error = source["error"];
	        this.user = this.convertValues(source["user"], UserDTO);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ReplyDTO {
	    id: string;
	    authorName: string;
	    preview: string;
	
	    static createFrom(source: any = {}) {
	        return new ReplyDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.authorName = source["authorName"];
	        this.preview = source["preview"];
	    }
	}
	export class PollOptionDTO {
	    id: number;
	    text: string;
	    count: number;
	    me: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PollOptionDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.text = source["text"];
	        this.count = source["count"];
	        this.me = source["me"];
	    }
	}
	export class PollDTO {
	    question: string;
	    options: PollOptionDTO[];
	    totalVotes: number;
	    finalized: boolean;
	    multi: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PollDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.question = source["question"];
	        this.options = this.convertValues(source["options"], PollOptionDTO);
	        this.totalVotes = source["totalVotes"];
	        this.finalized = source["finalized"];
	        this.multi = source["multi"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ReactionDTO {
	    emoji: string;
	    emojiUrl: string;
	    count: number;
	    me: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ReactionDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.emoji = source["emoji"];
	        this.emojiUrl = source["emojiUrl"];
	        this.count = source["count"];
	        this.me = source["me"];
	    }
	}
	export class MessageDTO {
	    id: string;
	    channelId: string;
	    author: UserDTO;
	    content: string;
	    timestamp: string;
	    edited: boolean;
	    mine: boolean;
	    nonce: string;
	    msgType: number;
	    attachments: AttachmentDTO[];
	    embeds: EmbedDTO[];
	    reactions: ReactionDTO[];
	    buttons: ButtonDTO[];
	    poll?: PollDTO;
	    replyTo?: ReplyDTO;
	    mentions: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new MessageDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.channelId = source["channelId"];
	        this.author = this.convertValues(source["author"], UserDTO);
	        this.content = source["content"];
	        this.timestamp = source["timestamp"];
	        this.edited = source["edited"];
	        this.mine = source["mine"];
	        this.nonce = source["nonce"];
	        this.msgType = source["msgType"];
	        this.attachments = this.convertValues(source["attachments"], AttachmentDTO);
	        this.embeds = this.convertValues(source["embeds"], EmbedDTO);
	        this.reactions = this.convertValues(source["reactions"], ReactionDTO);
	        this.buttons = this.convertValues(source["buttons"], ButtonDTO);
	        this.poll = this.convertValues(source["poll"], PollDTO);
	        this.replyTo = this.convertValues(source["replyTo"], ReplyDTO);
	        this.mentions = source["mentions"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class ProfileDTO {
	    id: string;
	    username: string;
	    displayName: string;
	    avatarUrl: string;
	    bannerUrl: string;
	    accentColor: string;
	    bio: string;
	    pronouns: string;
	    bot: boolean;
	    badgeIcons: string[];
	
	    static createFrom(source: any = {}) {
	        return new ProfileDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.displayName = source["displayName"];
	        this.avatarUrl = source["avatarUrl"];
	        this.bannerUrl = source["bannerUrl"];
	        this.accentColor = source["accentColor"];
	        this.bio = source["bio"];
	        this.pronouns = source["pronouns"];
	        this.bot = source["bot"];
	        this.badgeIcons = source["badgeIcons"];
	    }
	}
	
	
	export class UploadFileInput {
	    filename: string;
	    data: string;
	
	    static createFrom(source: any = {}) {
	        return new UploadFileInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.data = source["data"];
	    }
	}

}

