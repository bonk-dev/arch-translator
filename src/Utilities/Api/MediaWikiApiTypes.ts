interface BasePage {
    ns: number
    title: string
    contentmodel: string
    pagelanguage: string
    pagelanguagehtmlcode: string
    pagelanguagedir: string
}

export interface MissingPage extends BasePage {
    missing: string
}

export interface RealPage extends BasePage {
    touched: string
    lastrevid: number
    lengtr: number
}

export interface RedirectPage extends RealPage {
    redirect: string
}

interface NormalizedInfo {
    from: string
    to: string
}

interface InterwikiLinkInfo {
    title: string
    iw: string
}

export interface InfoQueryResultKeyedObject {
    batchComplete: any
    query: {
        normalized?: NormalizedInfo[]
        pages: { [key: string]: (RealPage|RedirectPage) }
        interwiki: { [key: string]: InterwikiLinkInfo }
    }
}

export interface InfoQueryResultArray {
    batchComplete: any
    query: {
        normalized?: NormalizedInfo[]
        pages: (MissingPage|RealPage|RedirectPage)[]
    }
}

export interface LinkQueryLinkInfo {
    ns: number
    title: string
}

export interface LinkQueryPageInfo {
    pageid: number
    ns: number
    title: string
    links: LinkQueryLinkInfo[]
}

export interface LinkQueryResult {
    batchComplete: any
    query: {
        pages: { [key: string]: LinkQueryPageInfo }
    }
}