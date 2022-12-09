import {Contract, ContractInterface} from "ethers";
import React, {useCallback, useEffect, useState} from "react";
import { createClient } from 'urql'
import {Routes, Route, useParams} from "react-router-dom";
import {useAccount} from "wagmi";
import Block from "../components/Block";
import COLLECTION_ABI from "../contracts/collection_abi.json";
import {Collection_abi} from '../contracts/types'

function GridDetails() {
    const {collectionId} = useParams();
    const {address, connector} = useAccount();
    const [data, setData] = useState<any>({});
    const [mints, setMints] = useState<any[]>([]);
    const [currentMintLoaded, setCurrentMintLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null)
    const [parentCollections, setParentCollections] = useState<any[]>([]);

    useEffect(() => {
        if (!collectionId || !connector) return;
        try {
            (async () => {
                fetchMints()
                    .then(console.log)
                    .catch((error) => console.error("failed to fetch mints: ", error));

                const signer = await connector?.getSigner();
                const collectionContract = new Contract(
                    collectionId,
                    COLLECTION_ABI as ContractInterface,
                    signer
                );

                const M = (await collectionContract.M()).toString();
                const N = (await collectionContract.N()).toString();
                const owner = await collectionContract.Owner();
                const parent = await collectionContract.Parent();
                const minted = await collectionContract.minted();
                const baseURI = await collectionContract.baseURI();

                const name = await collectionContract.name();
                const sym = await collectionContract.symbol();
                setData({name, sym, M, N, owner, parent, minted, baseURI});
            })();
        } catch (err) {
            console.error(err);
        }
    }, [collectionId, connector]);

    const fetchMints = async () => {
        setCurrentMintLoaded(false)
        const client = createClient({
            url: 'https://api.thegraph.com/subgraphs/name/yashthakor/grid-one',
        });
        const resp = await client.query(
            `query Mints($collectionId: String!) {
              mints(where: { collection: $collectionId }) {
                id
                tokenId
                collection {
                  id
                }
              }
            }`,
            {
                collectionId: (collectionId || '').toLowerCase(),
            }
        ).toPromise();

        setMints(resp.data.mints);
        setCurrentMintLoaded(true);
    };

    const handleCompleteCollection = async (e: any) => {
        e.preventDefault();
        if (!collectionId) return;
        const signer = await connector?.getSigner();

        const collectionContract = new Contract(
            collectionId,
            COLLECTION_ABI as ContractInterface,
            signer
        );

        try {
            const completeTx = await collectionContract.complete();
            await completeTx.wait();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCompleteSetup = async (e: any) => {
        e.preventDefault();
        if (!collectionId) return;
        const signer = await connector?.getSigner();

        const collectionContract: Collection_abi = new Contract(
            collectionId,
            COLLECTION_ABI as ContractInterface,
            signer
        ) as Collection_abi;

        try {
            const baseURI = `https://eth-india.s3.ap-south-1.amazonaws.com/${address}/${collectionId}`
            const setupTX = await collectionContract.setBaseURI(baseURI);
            await setupTX.wait();
            setData({
                ...data,
                baseURI,
            })
        } catch (err) {
            console.error(err);
        }
    };

    const fetchParent = useCallback((parent: string, otherParents: any[] = []) => {
        const client = createClient({
            url: 'https://api.thegraph.com/subgraphs/name/yashthakor/grid-one',
        });
        client.query(
            `query Collection($id: String!) {
                collection(id: $id) {
                  id
                  parent
                  baseUrl
                  mint {
                    id
                    tokenId
                  }
                  name
                  owner
                }
            }`,
            {
                id: (parent || '').toLowerCase(),
            }
        ).toPromise()
            .then((resp) => {
                if (!resp.data?.collection?.parent) {
                    setParentCollections([...otherParents]);
                    const mappedMints = Array.from({length: Number(data.N) * Number(data.M)});
                    mints.map((m) => {
                        mappedMints[Number(m.tokenId.toString())] = {
                            ...m,
                            owner: address,
                            meta: `${data.baseURI}/${m.tokenId}.json`,
                        }
                    })
                    otherParents.reverse().map((op: any) => {
                        op.mints.map((mint: any) => {
                            if (!mappedMints[Number(mint.tokenId)]) {
                                mappedMints[Number(mint.tokenId.toString())] = {
                                    ...mint,
                                    owner: op.owner,
                                    meta: `${op.baseUrl}/${mint.tokenId}.json`,
                                }
                            }
                        });
                    });
                    setMints([...mappedMints]);
                    return;
                }
                fetchParent(resp.data?.data?.collection?.parent, [...otherParents, resp.data?.data?.collection]);
            })
            .catch((error) => console.error('failed to fetch parents: ', error))
            .finally(() => setParentCollections([...otherParents]));
    }, [mints, data?.N, data?.M]);

    useEffect(() => {
        if (!collectionId) return;
        try {
            (async () => {
                const signer = await connector?.getSigner();
                const collectionContract = new Contract(
                    collectionId,
                    COLLECTION_ABI as ContractInterface,
                    signer
                );

                const M = (await collectionContract.M()).toString();
                const N = (await collectionContract.N()).toString();
                const owner = await collectionContract.Owner();
                const parent = await collectionContract.Parent();
                const minted = await collectionContract.minted();
                const baseURI = await collectionContract.baseURI();

                const name = await collectionContract.name();
                const sym = await collectionContract.symbol();

                setData({name, sym, M, N, owner, parent, minted, baseURI});
                fetchMints()
                    .then(console.log)
                    .catch((error) => console.error("failed to fetch mints: ", error));
            })();
        } catch (err) {
            console.error(err);
        }
    }, [collectionId]);

    const setMintDetails = useCallback((index: number, meta: string) => {
        mints[index] = {
            id: index.toString(),
            tokenId: index.toString(),
            meta
        };
        setMints([...mints]);
    }, [mints]);

    useEffect(() => {
        if (data.N && data.M && currentMintLoaded) {
            fetchParent(data.parent, []);
        }
    }, [data?.N, data?.M, data?.parent, currentMintLoaded]);

    useEffect(() => {
        if (error) {
            setTimeout(() => setError(null), 3000);
        }
    }, [error])

    console.log(data);

    if (!data.M || !data.N) return <progress className="progress"></progress>;

    return (
        <div className="container m-auto my-4">
            {data.owner === address && (
                <div className="flex justify-center my-4 mb-8">
                    {data.baseURI && <button className="retro-btn" onClick={handleCompleteCollection}>
                        Complete Grid
                    </button>}
                    {!data.baseURI && <button className="retro-btn" onClick={handleCompleteSetup}>
                        Complete Base URI setup
                    </button>}
                </div>
            )}
            {error && (
                <div className="flex justify-center my-4 mb-8 text-red-500">
                    {error}
                </div>
            )}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${data.M}, 1fr)`,
                    gridTemplateRows: `repeat(${data.M}, 1fr)`,
                }}
                className="mx-auto w-2/3"
            >
                {mints.map((m, i) => (
                    <div
                        key={m?.tokenId || i}
                        className="border border-black p-5 aspect-square"
                    >
                        <Block
                            key={i}
                            owner={data.owner}
                            collection={collectionId}
                            baseURI={data.baseURI}
                            index={i}
                            mint={m}
                            updateMint={setMintDetails}
                            setError={setError}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GridDetails;
